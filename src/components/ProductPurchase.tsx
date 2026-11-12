"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarClock, Check, ChevronRight, Info, Minus, PackageCheck, Plus, ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";
import { GRADE_CODES, GRADES, TEMPLATE_CODES, TEMPLATES, TERMS } from "@/data/master";
import { yen } from "@/lib/format";
import { findConfig, quote, rentalOffers, rentOrBuy, shopOffers } from "@/lib/pricing";
import type { Device, GradeCode, TemplateCode, Term } from "@/lib/types";
import { SiteIcon } from "./ui";

/** 実在レンタル会社の掲載（サーバーで必要な項目だけに絞って渡す） */
export interface ListedOffer {
  key: string;
  companyId: string;
  companyName: string;
  spec: string;
  monthly: number;
  note: string;
  url: string;
  inStock: boolean | null;
}

type Mode = "rent" | "buy";

/** 選択肢のボタン（EC の商品ページの「状態」「プラン」と同じ見た目） */
function Option({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`relative text-left rounded-[10px] border px-3 py-2.5 cursor-pointer transition-colors ${
        on ? "border-brand bg-brand-soft/50 shadow-[inset_0_0_0_1px_var(--color-brand)]" : "border-line bg-white hover:border-faint"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] font-semibold">
        {label}
        {hint && <span className="ml-2 font-normal text-mute">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

export function ProductPurchase({
  device,
  listed = [],
  favicons = {},
  meta,
  likeSlot,
  links,
}: {
  device: Device;
  listed?: ListedOffer[];
  favicons?: Record<string, string>;
  /** タイトル下の評価・お気に入り（サーバーコンポーネント） */
  meta?: React.ReactNode;
  /** 右の「お気に入りに保存」（サーバーコンポーネント） */
  likeSlot?: React.ReactNode;
  links: { href: string; label: string }[];
}) {
  const [mode, setMode] = useState<Mode>("rent");
  const [configId, setConfigId] = useState(device.configs[0].id);
  const [grade, setGrade] = useState<GradeCode>("A");
  const [tpl, setTpl] = useState<TemplateCode>("OFFICE");
  const [term, setTerm] = useState<Term>(24);
  const [qty, setQty] = useState(1);
  const [pick, setPick] = useState<string | null>(null);
  const [moreListed, setMoreListed] = useState(false);

  const cfg = findConfig(device, configId);
  const offers = rentalOffers(device, configId, grade, term, tpl);
  const chosen = offers.find((o) => o.supplierId === pick) ?? offers[0];
  const q = chosen ? quote(device, { configId, grade, term, template: tpl, quantity: qty, supplierId: chosen.supplierId }) : undefined;
  const shops = shopOffers(device, configId);
  const best = shops[0];
  const rb = rentOrBuy(device, configId, term);
  const listedHere = listed.filter((l) => !cfg.attrs.memory_gb || l.spec.startsWith(`${cfg.attrs.memory_gb}GB`));
  const inquiryHref = chosen
    ? `/inquiry?${new URLSearchParams({ device: device.slug, config: configId, grade, term: String(term), template: tpl, qty: String(qty), supplier: chosen.supplierId })}`
    : null;

  const price = mode === "rent" ? chosen?.monthly : best?.effective;
  const rows: [string, React.ReactNode][] =
    mode === "rent"
      ? [
          ["プラン", "月額レンタル"],
          ["構成", cfg.label],
          ["品質グレード", `${grade}（${GRADES[grade].label}）`],
          ["セットアップ", TEMPLATES[tpl].label],
          ["契約期間", `${term}か月`],
          ["保証", GRADES[grade].warranty],
          ["レンタル会社", chosen?.supplierName ?? "—"],
        ]
      : [
          ["プラン", "購入（新品）"],
          ["構成", cfg.label],
          ["購入先", best?.shopName ?? "—"],
          ["お届け", best?.shipping ?? "—"],
          ["保証", "メーカー保証（1年が一般的）"],
        ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-8">
      {/* 中央：商品情報と選択肢 */}
      <div className="flex flex-col gap-6 min-w-0">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[22px] sm:text-[26px] font-semibold leading-snug">
            {device.brand} {device.name}
            {device.subtitle && <span className="text-mute font-medium whitespace-nowrap">（{device.subtitle}）</span>}
          </h1>
          {meta}
        </div>

        <div className="flex flex-col gap-2 border-y border-hair py-4">
          <p className="m-0 flex items-baseline gap-1.5 flex-wrap">
            <b key={`${mode}${price}`} className="text-[34px] sm:text-[38px] font-semibold tabular-nums leading-none animate-fade">
              {price ? price.toLocaleString("ja-JP") : "—"}
            </b>
            <span className="text-[17px] font-semibold">円</span>
            <span className="text-[15px] font-semibold">{mode === "rent" ? "月額" : "実質"}</span>
            <span className="text-xs text-mute">（税込{mode === "buy" ? "・ポイント還元後" : ""}）</span>
          </p>
          <p className="m-0 text-[13px] text-sub">
            {mode === "rent" ? (
              <>
                初期費用：{chosen?.setupFee ? yen(chosen.setupFee) : "無料"}
                <span className="text-faint mx-2">|</span>
                総額（{term}か月・{qty}台）：<b className="font-semibold tabular-nums">{q ? yen(q.contractTotal) : "—"}</b>
              </>
            ) : (
              <>
                販売価格：{best ? yen(best.price) : "—"}
                {best?.points ? `（${best.points.toLocaleString("ja-JP")}pt 還元）` : ""}
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {["法人向け", mode === "rent" ? "データ消去証明つき" : "メーカー保証", mode === "rent" ? "故障時は交換" : "アフィリエイト"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[11px] text-sub bg-ground rounded-[6px] px-2 py-1">
                <Check size={12} aria-hidden="true" />
                {t}
              </span>
            ))}
            <span className="text-[11px] text-warn bg-warn-soft rounded-[6px] px-2 py-1">価格はサンプル</span>
          </div>
        </div>

        <Group label="プラン">
          <div className="grid grid-cols-2 gap-2">
            <Option on={mode === "rent"} onClick={() => setMode("rent")} className="!p-0 overflow-hidden">
              <span className={`block px-3 py-2 text-sm font-semibold border-b ${mode === "rent" ? "border-brand/30" : "border-hair"}`}>月額レンタル</span>
              <span className="block px-3 py-2.5">
                <b className="text-[17px] font-semibold tabular-nums">{offers[0] ? yen(offers[0].monthly) : "—"}</b>
                <span className="text-xs"> 月額〜</span>
                <span className="block mt-1 text-xs text-ok font-medium">故障交換・データ消去込み</span>
                <span className="block text-xs text-mute">{TERMS.join("・")}か月から選べる</span>
              </span>
            </Option>
            <Option on={mode === "buy"} onClick={() => setMode("buy")} className="!p-0 overflow-hidden">
              <span className={`block px-3 py-2 text-sm font-semibold border-b ${mode === "buy" ? "border-brand/30" : "border-hair"}`}>購入</span>
              <span className="block px-3 py-2.5">
                {best ? (
                  <>
                    <b className="text-[17px] font-semibold tabular-nums">{yen(best.effective)}</b>
                    <span className="text-xs"> 〜</span>
                    <span className="block mt-1 text-xs text-mute">{shops.length}ショップを比較</span>
                    {rb && (
                      <span className="block text-xs text-mute">
                        {term}か月なら{rb.cheaper === "rent" ? "借りる" : "買う"}方がお得
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-mute">この構成の販売価格は準備中です</span>
                )}
              </span>
            </Option>
          </div>
        </Group>

        <Group label="構成">
          <div className="flex flex-wrap gap-2">
            {device.configs.map((c) => (
              <Option key={c.id} on={c.id === configId} onClick={() => setConfigId(c.id)}>
                <span className="block text-sm font-medium">{c.label}</span>
                {c.officialPrice && <span className="block text-[11px] text-mute">メーカー価格 {yen(c.officialPrice)}</span>}
              </Option>
            ))}
          </div>
        </Group>

        {mode === "rent" ? (
          <>
            <Group label="品質グレード" hint={`${GRADES[grade].appearance}・バッテリー${GRADES[grade].batteryMin}`}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GRADE_CODES.map((g) => (
                  <Option key={g} on={g === grade} onClick={() => setGrade(g)}>
                    <span className="block text-[17px] font-semibold leading-tight">{g}</span>
                    <span className="block text-[11px] text-mute whitespace-nowrap">{GRADES[g].label}</span>
                  </Option>
                ))}
              </div>
            </Group>
            <Group label="セットアップ" hint={TEMPLATES[tpl].items.slice(0, 3).join("・") + "…"}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TEMPLATE_CODES.map((t) => (
                  <Option key={t} on={t === tpl} onClick={() => setTpl(t)}>
                    <span className="block text-sm font-semibold whitespace-nowrap">{TEMPLATES[t].label}</span>
                    <span className="block text-[11px] text-mute whitespace-nowrap">
                      {TEMPLATES[t].monthlyFee >= 0 ? "+" : "−"}
                      {yen(Math.abs(TEMPLATES[t].monthlyFee))}/月
                    </span>
                  </Option>
                ))}
              </div>
            </Group>
            <div className="flex flex-wrap gap-x-8 gap-y-6">
              <Group label="契約期間">
                <div className="flex gap-2">
                  {TERMS.map((t) => (
                    <Option key={t} on={t === term} onClick={() => setTerm(t)} className="min-w-20 text-center">
                      <span className="text-sm font-medium">{t}か月</span>
                    </Option>
                  ))}
                </div>
              </Group>
              <Group label="台数">
                <span className="inline-flex items-center border border-line rounded-[10px] bg-white">
                  <button type="button" aria-label="1台減らす" className="size-10 flex items-center justify-center cursor-pointer hover:bg-ground rounded-l-[10px]" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                    <Minus size={16} />
                  </button>
                  <span key={qty} className="w-12 text-center text-[15px] font-semibold tabular-nums animate-fade">
                    {qty}
                  </span>
                  <button type="button" aria-label="1台増やす" className="size-10 flex items-center justify-center cursor-pointer hover:bg-ground rounded-r-[10px]" onClick={() => setQty((n) => Math.min(200, n + 1))}>
                    <Plus size={16} />
                  </button>
                </span>
              </Group>
            </div>
          </>
        ) : (
          <Group label="購入先" hint="広告・アフィリエイトリンクを含みます">
            <ul className="m-0 p-0 list-none border border-line rounded-[12px] divide-y divide-hair overflow-hidden bg-white">
              {shops.map((s, i) => (
                <li key={s.shopId}>
                  {/* TODO: 各ショップのアフィリエイトURLに差し替え */}
                  <a href="#purchase" rel="sponsored nofollow" className="flex items-center gap-3 px-4 py-3 text-ink hover:no-underline hover:bg-ground/60">
                    <SiteIcon src={favicons[s.shopId === "official" ? device.brandId : s.shopId]} name={s.shopName} size={22} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {s.shopName}
                        {i === 0 && <span className="ml-2 text-[11px] text-ok">実質最安</span>}
                      </span>
                      <span className="block text-[11px] text-mute truncate">
                        {s.points ? `${s.points.toLocaleString("ja-JP")}pt還元・` : ""}
                        {s.shipping}
                      </span>
                    </span>
                    <b className="text-[15px] font-semibold tabular-nums">{yen(s.effective)}</b>
                    <ArrowUpRight size={15} className="text-faint" aria-hidden="true" />
                  </a>
                </li>
              ))}
              {!shops.length && <li className="px-4 py-3 text-sm text-mute">準備中です</li>}
            </ul>
          </Group>
        )}

        {/* 選択内容のまとめ */}
        <dl className="m-0 bg-ground rounded-[12px] px-4 py-3 grid grid-cols-[96px_1fr] gap-y-1.5 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-mute">{k}</dt>
              <dd className="m-0 text-link">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1.5 text-[13px]">
          <Link href="/guide/grades" className="inline-flex items-center gap-0.5">
            品質グレードの基準 <ChevronRight size={14} aria-hidden="true" />
          </Link>
          <a href="#faq" className="inline-flex items-center gap-0.5">
            レンタルに関するよくある質問 <ChevronRight size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* 右：お届け・申し込み */}
      <aside aria-label="申し込み" className="flex flex-col gap-4 xl:sticky xl:top-[124px] xl:self-start">
        <div className="border border-line rounded-[14px] p-4 flex flex-col gap-3 bg-white">
          {mode === "rent" ? (
            <>
              <p className="m-0 text-[15px] font-semibold inline-flex items-center gap-2">
                <PackageCheck size={18} className="text-ok" aria-hidden="true" />
                在庫あり<span className="text-[11px] font-normal text-warn">（サンプル）</span>
              </p>
              <p className="m-0 text-[13px] text-sub flex flex-col gap-1">
                <span className="inline-flex items-center gap-1.5">
                  <Truck size={14} className="text-mute" aria-hidden="true" />
                  最短 {chosen?.leadDays ?? "—"} 営業日でお届け
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-mute" aria-hidden="true" />
                  故障時：{chosen?.swap ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock size={14} className="text-mute" aria-hidden="true" />
                  {term}か月契約・途中で構成変更の相談可
                </span>
              </p>
              <div className="border-t border-hair pt-3">
                <p className="m-0 text-xs text-mute">月額合計（{qty}台）</p>
                <p key={q?.monthlyTotal} className="m-0 text-[26px] font-semibold tabular-nums leading-tight animate-fade">
                  {q ? yen(q.monthlyTotal) : "—"}
                </p>
              </div>
              {inquiryHref ? (
                <Link href={inquiryHref} className="btn btn-primary w-full !py-3 !rounded-[12px]">
                  この内容で見積を依頼
                </Link>
              ) : (
                <span className="btn w-full bg-hair text-faint !rounded-[12px]">対応する会社がありません</span>
              )}
            </>
          ) : (
            <>
              <p className="m-0 text-[15px] font-semibold">{best ? `${best.shopName}が実質最安` : "販売価格は準備中"}</p>
              {best && (
                <p className="m-0 text-[13px] text-sub inline-flex items-center gap-1.5">
                  <Truck size={14} className="text-mute" aria-hidden="true" />
                  {best.shipping}
                </p>
              )}
              {best && (
                <a href="#purchase" rel="sponsored nofollow" className="btn w-full !py-3 !rounded-[12px] bg-buy text-white hover:bg-[#a83f00] hover:text-white">
                  {best.shopName}で見る
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              )}
            </>
          )}
          {likeSlot}
          <p className="m-0 text-[11px] text-faint leading-relaxed">
            {mode === "rent"
              ? "審査・契約・配送は各レンタル会社が行います。xmall はお見積りの取り次ぎのみ（無料）。"
              : "購入は各ショップのサイトで行います。xmall はショップから紹介料を受け取ることがあります。"}
          </p>
        </div>

        {mode === "rent" && offers.length > 0 && (
          <div className="border border-line rounded-[14px] bg-white overflow-hidden">
            <p className="m-0 px-4 pt-3 pb-2 text-[13px] font-semibold flex justify-between">
              レンタル会社を選ぶ <span className="text-[11px] font-normal text-warn">サンプル</span>
            </p>
            <ul className="m-0 p-0 list-none divide-y divide-hair">
              {offers.map((o, i) => {
                const on = o.supplierId === chosen?.supplierId;
                return (
                  <li key={o.supplierId}>
                    <button type="button" role="radio" aria-checked={on} onClick={() => setPick(o.supplierId)} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left cursor-pointer ${on ? "bg-brand-soft/50" : "hover:bg-ground/60"}`}>
                      <span className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center ${on ? "border-brand" : "border-line"}`}>{on && <span className="size-2 rounded-full bg-brand" />}</span>
                      <span className="flex-1 min-w-0 text-[13px] truncate">
                        {o.supplierName}
                        {o.certified && <BadgeCheck size={13} className="inline ml-1 -mt-0.5 text-brand" aria-label="xmall認定" />}
                      </span>
                      <span className="text-right">
                        <b className="block text-[13px] font-semibold tabular-nums">{yen(o.monthly)}</b>
                        {i === 0 && <span className="block text-[10px] text-ok">最安</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {listedHere.length > 0 && (
          <div className="border border-line rounded-[14px] bg-white overflow-hidden">
            <p className="m-0 px-4 pt-3 pb-2 text-[13px] font-semibold inline-flex items-center gap-1.5">
              他社サイトの掲載価格
              <span title="各社の公開ページから取得した価格です。提携先ではありません。" className="inline-flex text-faint cursor-help">
                <Info size={13} aria-label="説明" />
              </span>
            </p>
            <ul className="m-0 p-0 list-none divide-y divide-hair">
              {(moreListed ? listedHere : listedHere.slice(0, 3)).map((l) => (
                <li key={l.key}>
                  <a href={l.url} target="_blank" rel="nofollow noopener noreferrer" className="flex items-center gap-2.5 px-4 py-2.5 text-ink hover:no-underline hover:bg-ground/60">
                    <SiteIcon src={favicons[l.companyId]} name={l.companyName} size={18} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] truncate">{l.companyName}</span>
                      <span className="block text-[10px] text-faint truncate">{l.note}</span>
                    </span>
                    <b className="text-[13px] font-semibold tabular-nums">{yen(l.monthly)}</b>
                    <ArrowUpRight size={13} className="text-faint" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            {listedHere.length > 3 && (
              <button type="button" onClick={() => setMoreListed((v) => !v)} className="w-full px-4 py-2 text-xs text-link cursor-pointer border-t border-hair">
                {moreListed ? "閉じる" : `すべて表示（${listedHere.length}）`}
              </button>
            )}
          </div>
        )}

        <ul className="m-0 p-0 list-none border border-line rounded-[14px] bg-white px-4 py-3 flex flex-col gap-2 text-[13px]">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-flex items-center gap-0.5">
                {l.label} <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      {/* スマホ：下端に追従する申し込みバー */}
      <div className="xl:hidden sticky bottom-3 z-20 col-span-full">
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xl rounded-[16px] shadow-[var(--shadow-lift)] border border-hair px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="m-0 text-[11px] text-mute truncate">
              {cfg.label}・{mode === "rent" ? `${qty}台・月額` : "実質"}
            </p>
            <p key={`${mode}${price}${qty}`} className="m-0 text-[20px] font-semibold tabular-nums leading-tight animate-fade">
              {mode === "rent" ? (q ? yen(q.monthlyTotal) : "—") : best ? yen(best.effective) : "—"}
            </p>
          </div>
          {mode === "rent" ? (
            inquiryHref && (
              <Link href={inquiryHref} className="btn btn-primary !py-2.5 !px-5 shrink-0">
                見積を依頼
              </Link>
            )
          ) : (
            best && (
              <a href="#purchase" rel="sponsored nofollow" className="btn bg-buy text-white hover:text-white !py-2.5 !px-5 shrink-0">
                ショップへ
              </a>
            )
          )}
        </div>
      </div>
    </div>
  );
}
