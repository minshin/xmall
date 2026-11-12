"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DeviceSummary } from "@/lib/catalog";
import { yen } from "@/lib/format";
import { DeviceIllustration } from "./DeviceIllustration";

type FacetKey = "brand" | "cpu" | "mem" | "size" | "os";
type Sort = "price" | "popular" | "suppliers";

const sizeBucket = (inch: number) => (inch < 13.9 ? "13インチ以下" : inch < 15 ? "14インチ" : "15インチ以上");

const FACETS: { key: FacetKey; title: string; values: (d: DeviceSummary) => string[] }[] = [
  { key: "brand", title: "ブランド", values: (d) => [d.brand] },
  { key: "cpu", title: "CPU", values: (d) => [d.cpuFamily === "Apple M" ? "Apple Mシリーズ" : d.cpuFamily] },
  { key: "mem", title: "メモリ", values: (d) => d.memoryOptionsGb.map((m) => `${m}GB`) },
  { key: "size", title: "画面サイズ", values: (d) => [sizeBucket(d.screenInch)] },
  { key: "os", title: "OS", values: (d) => [d.os] },
];

export function CatalogBrowser({ devices }: { devices: DeviceSummary[] }) {
  const [sel, setSel] = useState<Record<FacetKey, string[]>>({ brand: [], cpu: [], mem: [], size: [], os: [] });
  const [sort, setSort] = useState<Sort>("price");

  const options = useMemo(
    () =>
      FACETS.map((f) => {
        const counts = new Map<string, number>();
        devices.forEach((d) => new Set(f.values(d)).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1)));
        return { ...f, opts: [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "ja")) };
      }),
    [devices],
  );

  const list = useMemo(() => {
    const hit = devices.filter((d) => FACETS.every((f) => !sel[f.key].length || f.values(d).some((v) => sel[f.key].includes(v))));
    return hit.sort((a, b) =>
      sort === "price" ? (a.rentFrom ?? Infinity) - (b.rentFrom ?? Infinity) : sort === "popular" ? b.social.likes - a.social.likes : b.supplierCount - a.supplierCount,
    );
  }, [devices, sel, sort]);

  const toggle = (k: FacetKey, v: string) =>
    setSel((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  const chip = (on: boolean) =>
    `rounded-lg border px-2.5 py-1.5 text-xs min-h-8 cursor-pointer ${on ? "border-brand bg-brand-soft" : "border-[#D6D6D0] bg-white"}`;

  return (
    <div className="flex flex-wrap gap-6 items-start">
      <aside aria-label="絞り込み" className="flex-[1_1_220px] max-w-[250px] flex flex-col gap-4 text-[13px]">
        <div className="flex justify-between items-baseline">
          <b className="text-[15px]">絞り込み</b>
          <button type="button" className="text-brand text-xs cursor-pointer p-1.5" onClick={() => setSel({ brand: [], cpu: [], mem: [], size: [], os: [] })}>
            クリア
          </button>
        </div>
        {options.map((f) => (
          <fieldset key={f.key} className="m-0 p-0 border-0">
            <legend className="mb-2 font-bold text-sub text-xs">{f.title}</legend>
            <div className="flex flex-wrap gap-1.5">
              {f.opts.map(([v, n]) => (
                <button key={v} type="button" aria-pressed={sel[f.key].includes(v)} className={chip(sel[f.key].includes(v))} onClick={() => toggle(f.key, v)}>
                  {v} <span className="text-mute">{n}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <p className="border-t border-line pt-3 text-mute text-xs leading-relaxed">
          月額は24か月・品質グレードA・設定テンプレート「一般事務」での最安値です。
        </p>
      </aside>

      <section aria-label="機種一覧" className="flex-[999_1_640px] min-w-0">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-3.5">
          <h1 className="m-0 text-[22px] font-bold">
            ノートPC <span className="text-sm font-normal text-mute">{list.length}機種</span>
          </h1>
          <div className="flex gap-1 text-xs">
            {(
              [
                ["price", "月額が安い順"],
                ["popular", "人気順"],
                ["suppliers", "会社が多い順"],
              ] as [Sort, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                className={`rounded-md px-2.5 py-1.5 cursor-pointer ${sort === k ? "bg-brand-soft text-[#1F3F9C] font-bold" : "text-sub"}`}
                onClick={() => setSort(k)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 && (
          <div className="card border-dashed p-10 text-center text-sub">条件に合う機種がありません。条件を減らしてください。</div>
        )}

        <div className="flex flex-col gap-4">
          {list.map((d) => (
            <article key={d.slug} className="card overflow-hidden flex flex-wrap">
              <Link href={d.url} aria-label={`${d.name}の詳細`} className="flex-[1_1_300px] min-h-[240px] bg-[#ECEEF2] flex items-center justify-center">
                <DeviceIllustration color={d.bodyColor} id={d.slug} />
              </Link>
              <div className="flex-[2_1_420px] p-6 flex flex-col gap-3.5">
                <div>
                  <span className="text-xs text-mute">
                    {d.brand} ・ {d.chip}
                  </span>
                  <h2 className="mt-1 mb-0 text-[22px] font-bold">
                    <Link href={d.url} className="text-ink no-underline">
                      {d.name}
                    </Link>
                  </h2>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-sub">
                    <span className="text-buy">♥ 気になる {d.social.likes.toLocaleString("ja-JP")}</span>
                    <span>
                      ★ {d.social.rating}（口コミ {d.social.reviewCount}件）
                    </span>
                    <span>「{d.social.topTag}」</span>
                    {!d.verified && <span className="rounded bg-[#FFF1DD] text-[#8A4B00] px-1.5">解説準備中</span>}
                  </div>
                </div>
                <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-4 gap-y-2 m-0 text-[13px]">
                  <Spec k="CPU" v={d.chip} />
                  <Spec k="メモリ / ストレージ" v={`${d.memoryOptionsGb.join("・")}GB / ${d.storageRange}`} />
                  <Spec k="画面" v={`${d.screenInch}インチ`} />
                  <Spec k="重量" v={`約${d.weightKg}kg`} />
                  <Spec k="OS" v={d.os} />
                </dl>
                <div className="border-t border-[#EEEEEA] pt-3 flex flex-wrap justify-between items-baseline gap-3 text-[13px]">
                  <span>
                    借りる 月額 <b className="text-[22px]">{d.rentFrom ? yen(d.rentFrom) : "—"}</b>〜
                    <span className="text-mute ml-1">（{d.supplierCount}社）</span>
                  </span>
                  <span className="text-buy">
                    買う {d.buyFrom ? <b className="text-[18px]">実質 {yen(d.buyFrom)}〜</b> : "ショップ価格は準備中"}
                  </span>
                  <Link href={d.url} className="text-sm">
                    比較して選ぶ →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-mute">※ レンタル会社名・月額・公式以外のショップ価格はサンプルです。商品画像は準備中のイラストです。</p>
      </section>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-mute text-[11px]">{k}</dt>
      <dd className="m-0 mt-0.5">{v}</dd>
    </div>
  );
}
