/**
 * 画像素材（media テーブル＋Storage のファイル）の書き出し・読み込み。
 * 素材はリポジトリに置かないので、バックアップや環境間（ローカル → 本番）の移動にはこれを使う。
 *
 *   npm run media:export -- <ディレクトリ>   今の環境（.env.local）の素材を書き出す
 *   npm run media:import -- <ディレクトリ>   書き出した素材を今の環境に入れる（同じ path は上書き）
 *
 * 別の環境に入れるときは --env-file を差し替える：
 *   npx tsx --env-file=.env.production scripts/media.ts import <ディレクトリ>
 *
 * 書き出し先はリポジトリの外にすること（例：~/xmall-media）。
 * 製品画像の紐づけは製品の slug、favicon の紐づけはサイトの id で対応づける（相手側に無いものは飛ばす）。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import postgres from "postgres";
import { mediaUrl } from "../src/lib/media";
import { uploadMedia, type MediaRow } from "../src/lib/storage";

interface Manifest {
  exportedAt: string;
  media: Pick<MediaRow, "id" | "path" | "mime" | "alt" | "credit" | "kind">[];
  productMedia: { slug: string; mediaId: string; sort: number }[];
  favicons: { siteId: string; mediaId: string }[];
}

const REPO = resolve(import.meta.dirname, "..");

function outsideRepo(dir: string) {
  const abs = resolve(dir);
  const rel = relative(REPO, abs);
  if (!rel.startsWith("..") && !isAbsolute(rel)) throw new Error(`素材はリポジトリの外に置いてください（${abs}）`);
  return abs;
}

async function exportTo(sql: postgres.Sql, dir: string) {
  const media = await sql<Manifest["media"]>`select id, path, mime, alt, credit, kind from public.media order by created_at`;
  const productMedia = await sql<Manifest["productMedia"]>`
    select p.slug, pm.media_id as "mediaId", pm.sort from public.product_media pm join public.products p on p.id = pm.product_id order by p.slug, pm.sort`;
  const favicons = await sql<Manifest["favicons"]>`select id as "siteId", favicon_id as "mediaId" from public.sites where favicon_id is not null`;
  for (const m of media) {
    const r = await fetch(mediaUrl(m.path));
    if (!r.ok) throw new Error(`${m.path} を取得できません（${r.status}）`);
    const file = join(dir, "files", m.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, new Uint8Array(await r.arrayBuffer()));
  }
  const manifest: Manifest = { exportedAt: new Date().toISOString(), media: [...media], productMedia: [...productMedia], favicons: [...favicons] };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`書き出し：画像 ${media.length} 件（製品の紐づけ ${productMedia.length}・favicon ${favicons.length}）→ ${dir}`);
}

async function importFrom(sql: postgres.Sql, dir: string) {
  const manifest: Manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const idMap = new Map<string, string>();
  for (const m of manifest.media) {
    const row = await uploadMedia(sql, {
      data: readFileSync(join(dir, "files", m.path)),
      mime: m.mime,
      path: m.path,
      kind: m.kind,
      alt: m.alt,
      credit: m.credit,
    });
    idMap.set(m.id, row.id);
  }
  let linked = 0;
  for (const pm of manifest.productMedia) {
    const mediaId = idMap.get(pm.mediaId);
    const r = await sql`
      insert into public.product_media (product_id, media_id, sort)
      select id, ${mediaId!}, ${pm.sort} from public.products where slug = ${pm.slug}
      on conflict (product_id, media_id) do update set sort = excluded.sort`;
    linked += r.count;
  }
  let favs = 0;
  for (const f of manifest.favicons) {
    const r = await sql`update public.sites set favicon_id = ${idMap.get(f.mediaId)!}, updated_at = now() where id = ${f.siteId}`;
    favs += r.count;
  }
  console.log(`読み込み：画像 ${idMap.size} 件、製品への紐づけ ${linked} 件、favicon ${favs} 件`);
}

async function main() {
  const [cmd, dirArg] = process.argv.slice(2);
  if ((cmd !== "export" && cmd !== "import") || !dirArg) {
    console.error("使い方: npm run media:export -- <ディレクトリ> ／ npm run media:import -- <ディレクトリ>");
    process.exit(1);
  }
  const dir = outsideRepo(dirArg);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    if (cmd === "export") await exportTo(sql, dir);
    else await importFrom(sql, dir);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
