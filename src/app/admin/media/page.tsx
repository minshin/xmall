import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Trash2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import * as admin from "@/lib/repo-admin";
import type { MediaItem } from "@/lib/repo-admin";
import { mediaAction, uploadMediaAction } from "../catalog-actions";
import { NoDb } from "../NoDb";
import { ActionForm, ConfirmButton, ImageUpload, input } from "../ui";

export const metadata: Metadata = { title: "画像" };

const KINDS: [MediaItem["kind"] | "", string][] = [
  ["", "すべて"],
  ["product", "製品"],
  ["favicon", "favicon"],
  ["other", "その他"],
];

export default function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  return (
    <Suspense fallback={<p className="text-sm text-mute">読み込み中…</p>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/media">["searchParams"] }) {
  await requireRole("editor", "/admin/media");
  const sql = getSql();
  if (!sql) return <NoDb />;
  const k = (await searchParams).kind;
  const kind = (["product", "favicon", "other"] as const).find((x) => x === k);
  const media = await admin.listMedia(sql, { kind });

  return (
    <>
      <div>
        <h1 className="m-0 text-[32px] font-semibold">画像</h1>
        <p className="m-0 mt-1 text-sm text-mute">バナーや記事用の画像はここから。製品の画像は製品ページ、favicon はサイト・favicon から登録すると自動で紐づきます。</p>
      </div>
      <section className="card p-5">
        <ActionForm action={uploadMediaAction} submit="アップロード">
          <ImageUpload />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="alt" placeholder="代替テキスト" className={input} />
            <input name="credit" placeholder="出典・権利表記" className={input} />
          </div>
        </ActionForm>
      </section>
      <nav className="flex gap-1.5 text-sm">
        {KINDS.map(([v, l]) => (
          <Link
            key={l}
            href={v ? `/admin/media?kind=${v}` : "/admin/media"}
            className={`rounded-full px-3.5 py-1.5 hover:no-underline ${(kind ?? "") === v ? "bg-ink text-white" : "bg-white text-ink"}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <ul className="m-0 p-0 list-none grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {media.map((m) => (
          <li key={m.id} className="card overflow-hidden flex flex-col">
            <div className={`relative ${m.kind === "favicon" ? "aspect-square" : "aspect-[16/10]"} bg-ground flex items-center justify-center`}>
              {m.kind === "favicon" || m.mime === "image/x-icon" || m.mime === "image/vnd.microsoft.icon" || m.mime === "image/svg+xml" ? (
                // eslint-disable-next-line @next/next/no-img-element -- .ico / svg は最適化しない
                <img src={m.url} alt={m.alt} className="w-12 h-12 object-contain" />
              ) : (
                <Image src={m.url} alt={m.alt} fill sizes="280px" className="object-cover" />
              )}
            </div>
            <div className="p-3 flex flex-col gap-2 text-xs">
              <input readOnly value={m.url} className={`${input} !text-[11px] text-mute`} aria-label="URL" />
              <form action={mediaAction} className="flex flex-col gap-1.5">
                <input type="hidden" name="mediaId" value={m.id} />
                <input name="alt" defaultValue={m.alt} placeholder="代替テキスト" className={input} />
                <input name="credit" defaultValue={m.credit ?? ""} placeholder="出典" className={input} />
                <button className="self-start text-link cursor-pointer">保存</button>
              </form>
              <div className="flex items-center justify-between text-faint">
                <span>
                  {m.width && m.height ? `${m.width}×${m.height}・` : ""}
                  {Math.round(m.bytes / 1024)}KB{m.usedBy ? `・使用 ${m.usedBy}` : ""}
                </span>
                <form action={mediaAction}>
                  <input type="hidden" name="mediaId" value={m.id} />
                  <input type="hidden" name="op" value="delete" />
                  <ConfirmButton
                    message={m.usedBy ? `この画像は ${m.usedBy} か所で使われています。削除すると表示されなくなります。` : "この画像を削除します。"}
                    className="p-1.5 rounded-md hover:text-[#d70015] hover:bg-ground cursor-pointer"
                  >
                    <Trash2 size={14} aria-label="削除" />
                  </ConfirmButton>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
