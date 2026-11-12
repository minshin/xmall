/**
 * レンタル会社サイトのスクレイピング共通処理。
 *
 * 方針：
 *   * robots.txt で許可されたページだけを、ホストごとに間隔をあけて取得する（既定 1.5 秒）。
 *   * ページに書かれている値だけを取り出す。読み取れない項目は null にし、推測で埋めない。
 *   * 価格の税区分はページの表記どおり（表記が無ければ "unknown"）。
 */
import { DEVICES } from "../../src/data/devices";
import type { RentalCompanyData, RentalListingData, RentalPriceData } from "../../src/lib/types";

export type { RentalCompanyData, RentalListingData, RentalPriceData };

export interface SiteScraper {
  company: RentalCompanyData;
  /** 一覧ページをたどって商品ページの URL を集め、各商品を解析する */
  scrape(ctx: ScrapeContext): Promise<RentalListingData[]>;
}

export interface ScrapeContext {
  fetchHtml(url: string): Promise<string>;
  log(msg: string): void;
  /** 取得する商品数の上限（動作確認用） */
  limit?: number;
}

const UA = "Mozilla/5.0 (compatible; xmall-catalog-bot/0.1; +https://xmall.jp/)";
const lastAccess = new Map<string, number>();

export function createContext(opts: { delayMs?: number; limit?: number; verbose?: boolean } = {}): ScrapeContext {
  const delay = opts.delayMs ?? 1500;
  return {
    limit: opts.limit,
    log: (m) => {
      if (opts.verbose !== false) console.error(m);
    },
    async fetchHtml(url) {
      const host = new URL(url).host;
      const wait = (lastAccess.get(host) ?? 0) + delay - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastAccess.set(host, Date.now());
      const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ja" }, redirect: "follow" });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.text();
    },
  };
}

// ───────── HTML → テキスト行 ─────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", yen: "¥" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** ブロック要素ごとに改行した、空行なしのテキスト行 */
export function htmlToLines(html: string): string[] {
  const t = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, "")
    .replace(/<(br|\/p|\/tr|\/li|\/h\d|\/div|\/dt|\/dd|\/th|\/td|\/span|\/a|\/option)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(t)
    .normalize("NFKC")
    .split(/\r?\n/)
    .map((l) => l.replace(/[\s　]+/g, " ").trim())
    .filter(Boolean);
}

/** 仕様表の項目名。値が空欄のとき、次の項目名を値として拾わないために使う */
const SPEC_LABEL =
  /^(OS|初期導入済OS|発売日|製品型番|内臓カメラ|SSDストレージ|CPU|プロセッサー?|クロック数|メモリー?|ストレージ|SSD|HDD|グラフィックス?|グラフィックカード|ビデオチップ|ディスプレイ.*|画面.*|液晶.*|光学ドライブ|無線LAN|ワイヤレス|Bluetooth|カメラ|Webカメラ|サイズ.*|重量|質量|メーカー|シリーズ|型番)$/;

/** `key` の行（startAt 以降で最初）の次の行を返す。次の行が別の項目名なら空欄とみなして null */
export function valueAfter(lines: string[], key: string | RegExp, startAt = 0): string | null {
  for (let i = startAt; i < lines.length - 1; i++) {
    if (typeof key === "string" ? lines[i] === key : key.test(lines[i])) return SPEC_LABEL.test(lines[i + 1]) ? null : lines[i + 1];
  }
  return null;
}

export function indexOfLine(lines: string[], key: string | RegExp, startAt = 0): number {
  for (let i = startAt; i < lines.length; i++) if (typeof key === "string" ? lines[i] === key : key.test(lines[i])) return i;
  return -1;
}

/** 正規表現にマッチするリンク（絶対 URL・重複なし・出現順） */
export function links(html: string, base: string, pattern: RegExp): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"#]+)"/g)) {
    let u: URL;
    try {
      u = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (pattern.test(u.pathname + u.search)) out.add(u.toString());
  }
  return [...out];
}

/** "13,000円" → 13000。数字が無ければ null */
export function yen(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/[,，]/g, "").match(/(\d+)\s*円?/);
  return m ? Number(m[1]) : null;
}

/** "16GB" → 16、"1TB" → 1024。範囲表記（8～16GB）は null */
export function capacityGb(s: string | null | undefined): number | null {
  if (!s || /[～〜~]/.test(s)) return null;
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(TB|GB)?/i);
  if (!m) return null;
  return m[2]?.toUpperCase() === "TB" ? Math.round(Number(m[1]) * 1024) : Number(m[1]);
}

/** "3日間" "~1ヶ月" "1年" "24ヵ月" → 期間 */
export function parseTerm(label: string): { unit: "day" | "month"; value: number } | null {
  const s = label.replace(/\s/g, "");
  let m = s.match(/(\d+)日/);
  if (m) return { unit: "day", value: Number(m[1]) };
  m = s.match(/(\d+)[ヶケかカヵ]?月/);
  if (m) return { unit: "month", value: Number(m[1]) };
  m = s.match(/(\d+)年/);
  if (m) return { unit: "month", value: Number(m[1]) * 12 };
  return null;
}

export function price(label: string, yenValue: number, basis: RentalPriceData["basis"]): RentalPriceData | null {
  const term = parseTerm(label);
  if (!term || !yenValue) return null;
  return { termUnit: term.unit, termValue: term.value, priceYen: yenValue, basis, label };
}

export function dedupePrices(prices: (RentalPriceData | null)[]): RentalPriceData[] {
  const seen = new Set<string>();
  const out: RentalPriceData[] = [];
  for (const p of prices) {
    if (!p) continue;
    const k = `${p.termUnit}:${p.termValue}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

// ───────── カタログ機種との対応づけ ─────────

/**
 * 掲載商品がカタログのどの機種・構成にあたるか。
 * 世代違いを混ぜないよう、機種名と世代が確実に読み取れるものだけ対応づける（迷ったら null）。
 */
const RULES: { slug: string; test: (t: string) => boolean }[] = [
  { slug: "macbook-pro-14-m5", test: (t) => /MacBook ?Pro 14/i.test(t) && /\bM5\b(?! ?(Pro|Max))/i.test(t) },
  { slug: "macbook-air-13", test: (t) => /MacBook ?Air 13/i.test(t) && /\bM[2-5]\b/.test(t) },
  { slug: "thinkpad-x1-carbon", test: (t) => /X1 ?Carbon/i.test(t) && /(Gen ?1[23]\b|Aura|Core ?Ultra)/i.test(t) },
  { slug: "thinkpad-e14", test: (t) => /ThinkPad ?E14/i.test(t) },
  { slug: "latitude-5450", test: (t) => /Latitude ?5450/i.test(t) },
  { slug: "lets-note-sr", test: (t) => /CF-SR|Let'?s ?note ?SR\b/i.test(t) },
  { slug: "precision-5690", test: (t) => /Precision ?5690/i.test(t) },
];

export function matchCatalog(l: Pick<RentalListingData, "title" | "maker" | "model" | "memoryGb" | "storageGb">): {
  deviceSlug: string | null;
  configId: string | null;
} {
  const text = [l.maker, l.model, l.title].filter(Boolean).join(" ");
  const rule = RULES.find((r) => r.test(text));
  if (!rule) return { deviceSlug: null, configId: null };
  const device = DEVICES.find((d) => d.slug === rule.slug);
  const cfg = device?.configs.find((c) => c.memoryGb === l.memoryGb && c.storageGb === l.storageGb);
  return { deviceSlug: rule.slug, configId: cfg?.id ?? null };
}

/** タイトル等から「512GB SSD」「16GB」を拾う（SSD に隣接する方をストレージとみなす） */
export function capacitiesFromTitle(title: string): { memoryGb: number | null; storageGb: number | null } {
  const t = title.replace(/,/g, "");
  const storage =
    t.match(/(?:SSD|ストレージ)\s*[:：]?\s*(\d+)\s*(GB|TB)/i) ?? t.match(/(\d+)\s*(GB|TB)\s*(?:\(?SSD|ストレージ)/i);
  const memory = t.match(/メモリ\s*[:：]?\s*(\d+)\s*GB/i) ?? t.match(/(\d+)\s*GB\s*メモリ/i);
  const toGb = (m: RegExpMatchArray | null) => (m ? (m[2]?.toUpperCase() === "TB" ? Number(m[1]) * 1024 : Number(m[1])) : null);
  let memoryGb = toGb(memory);
  const storageGb = toGb(storage);
  if (memoryGb == null) {
    // 「/ 512GB SSD /16GB /」のような並び：ストレージ以外で 128GB 以下の値をメモリとみなす
    const all = [...t.matchAll(/(\d+)\s*GB/gi)].map((m) => Number(m[1])).filter((n) => n !== storageGb && n <= 128);
    memoryGb = all.length === 1 ? all[0] : null;
  }
  return { memoryGb, storageGb };
}

// ───────── 表記ゆれの正規化 ─────────

const MAKERS: [RegExp, string][] = [
  [/apple|macbook/i, "Apple"],
  [/lenovo|レノボ|thinkpad|ideapad/i, "Lenovo"],
  [/\bdell\b|latitude|vostro|inspiron|precision/i, "Dell"],
  [/\bhp\b|probook|elitebook/i, "HP"],
  [/富士通|fujitsu|lifebook|\bfmv/i, "富士通"],
  [/panasonic|パナソニック|let'?s ?note|レッツノート|\bcf-/i, "Panasonic"],
  [/dynabook|toshiba|東芝/i, "Dynabook"],
  [/\bnec\b|versapro|lavie/i, "NEC"],
  [/microsoft|surface/i, "Microsoft"],
  [/\basus\b|vivobook|zenbook/i, "ASUS"],
  [/\bacer\b/i, "Acer"],
  [/\bmsi\b/i, "MSI"],
  [/vaio/i, "VAIO"],
  [/huawei/i, "Huawei"],
];

export function detectMaker(text: string): string | null {
  return MAKERS.find(([re]) => re.test(text))?.[1] ?? null;
}

/** タイトル等から CPU 名を拾う（見つからなければ null） */
export function cpuFromText(text: string): string | null {
  const m = text.match(
    /(Apple )?M[1-5](?: ?(?:Pro|Max))?(?= |,|\)|\/|$)|Core ?Ultra ?[579](?: ?\d{3}[A-Z]*)?|Core ?i[3579](?:[- ]?\d{4,5}[A-Z]*)?|Core ?[3579] ?\d{3}[A-Z]*|Ryzen ?[3579](?: ?\d{4}[A-Z]*)?|Celeron|Atom[^ ,]*/i,
  );
  return m ? m[0].trim() : null;
}

/** 開始行 startAt 以降、「ラベル行・値行」の組を述語が通るあいだ読む */
export function pairs(
  lines: string[],
  startAt: number,
  isLabel: (s: string) => boolean,
  isValue: (s: string) => boolean,
): [string, string][] {
  const out: [string, string][] = [];
  let i = startAt;
  while (i < lines.length - 1 && isLabel(lines[i]) && isValue(lines[i + 1])) {
    out.push([lines[i], lines[i + 1]]);
    i += 2;
  }
  return out;
}

export function h1(html: string): string | null {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? htmlToLines(m[1]).join(" ") || null : null;
}

export const today = () => new Date().toISOString().slice(0, 10);
