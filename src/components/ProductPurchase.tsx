"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, ChevronRight, Info, MessageSquare, PackageX, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { yen } from "@/lib/format";
import { findConfig, monthlyFor, offerSpec, rentalOffers, rentOrBuy, TAX_LABEL, toCompare } from "@/lib/pricing";
import type { Device, RentalOffer } from "@/lib/types";
import { SiteIcon } from "./ui";

type Mode = "rent" | "buy";

/** 期間の選択肢（各社の料金表にある期間だけ出す） */
const TERM_CHOICES = [1, 3, 6, 12, 24, 36];

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

const fmtDate = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export function ProductPurchase({
  device,
  favicons = {},
  makerUrl,
  meta,
  likeSlot,
  links,
}: {
  device: Device;
  favicons?: Record<string, string>;
  /** メーカーのサイト（購入の案内先） */
  makerUrl?: string | null;
  /** タイトル下の評価・閲覧数（サーバーコンポーネント） */
  meta?: React.ReactNode;
  /** 「お気に入りに保存」（サーバーコンポーネント） */
  likeSlot?: React.ReactNode;
  links: { href: string; label: string }[];
}) {
  const hasRent = device.rentals.length > 0;
  const hasBuy = device.configs.some((c) => c.officialPrice);
  const [mode, setMode] = useState<Mode>(hasRent || !hasBuy ? "rent" : "buy");
  const [configId, setConfigId] = useState<string | null>(device.configs.length > 1 ? null : device.configs[0].id);
  const terms = useMemo(() => {
    const set = new Set(device.rentals.flatMap((o) => o.plans.map((p) => p.months)));
    return TERM_CHOICES.filter((t) => set.has(t));
  }, [device.rentals]);
  const [term, setTerm] = useState<number>(terms.includes(12) ? 12 : (terms.at(-1) ?? 12));
  const [pick, setPick] = useState<string | null>(null);

  const cfg = findConfig(device, configId);
  // 選んだ期間の月額で並べる（その期間の料金が無い掲載は後ろ）
  const rows = rentalOffers(device, configId)
    .map((o) => {
      const m = monthlyFor(o, term);
      return { o, monthly: m, compare: m === undefined ? Infinity : toCompare(m, o.priceTax) };
    })
    .sort((a, b) => a.compare - b.compare);
  const priced = rows.filter((r) => r.monthly !== undefined);
  const chosen = rows.find((r) => r.o.key === pick && r.monthly !== undefined) ?? priced[0];
  const official = configId ? cfg.officialPrice : device.configs.flatMap((c) => c.officialPrice ?? []).sort((a, b) => a - b)[0];
  const rb = configId ? rentOrBuy(device, configId, Math.max(term, 12)) : undefined;
  const companies = new Set(device.rentals.map((o) => o.companyId)).size;
  const latest = device.rentals.map((o) => o.fetchedAt).sort().at(-1);
  const inquiryHref = `/inquiry?${new URLSearchParams({ device: device.slug, ...(configId ? { config: configId } : {}), term: String(term) })}`;

  const go = (o: RentalOffer) => track("outbound_click", { kind: "rental", company: o.companyId, device: device.slug });

  const price = mode === "rent" ? chosen?.monthly : official;
  const configCount = (id: string) => device.rentals.filter((o) => o.configId === id).length;

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
            <span className="text-[15px] font-semibold">{mode === "rent" ? "月額" : "メーカー直販"}</span>
            <span className="text-xs text-mute">
              {mode === "rent" ? (chosen ? `（${TAX_LABEL[chosen.o.priceTax]}・${term}か月契約）` : "") : "（税込）"}
            </span>
          </p>
          <p className="m-0 text-[13px] text-sub">
            {mode === "rent" ? (
              hasRent ? (
                <>
                  {chosen ? `${chosen.o.companyName}の掲載価格` : `${term}か月の料金を掲載している会社がありません`}
                  <span className="text-faint mx-2">|</span>
                  {companies}社・{device.rentals.length}件を比較
                  {latest && <span className="text-mute">（{fmtDate(latest)} 時点）</span>}
                </>
              ) : (
                "現在、この機種を掲載しているレンタル会社はありません"
              )
            ) : official ? (
              "メーカーの公式価格（出典はページ下部）"
            ) : (
              "メーカー直販の価格はありません（販売終了・中古のみの機種など）"
            )}
          </p>
        </div>

        <Group label="プラン">
          <div className="grid grid-cols-2 gap-2">
            <Option on={mode === "rent"} onClick={() => setMode("rent")} className="!p-0 overflow-hidden">
              <span className={`block px-3 py-2 text-sm font-semibold border-b ${mode === "rent" ? "border-brand/30" : "border-hair"}`}>月額レンタル</span>
              <span className="block px-3 py-2.5">
                {hasRent ? (
                  <>
                    <b className="text-[17px] font-semibold tabular-nums">{yen(Math.min(...device.rentals.map((o) => o.monthly)))}</b>
                    <span className="text-xs"> 月額〜</span>
                    <span className="block mt-1 text-xs text-mute">{companies}社の掲載価格</span>
                  </>
                ) : (
                  <span className="text-xs text-mute">掲載なし</span>
                )}
              </span>
            </Option>
            <Option on={mode === "buy"} onClick={() => setMode("buy")} className="!p-0 overflow-hidden">
              <span className={`block px-3 py-2 text-sm font-semibold border-b ${mode === "buy" ? "border-brand/30" : "border-hair"}`}>購入</span>
              <span className="block px-3 py-2.5">
                {hasBuy ? (
                  <>
                    <b className="text-[17px] font-semibold tabular-nums">{yen(Math.min(...device.configs.flatMap((c) => c.officialPrice ?? [])))}</b>
                    <span className="text-xs"> 〜</span>
                    <span className="block mt-1 text-xs text-mute">メーカー直販</span>
                  </>
                ) : (
                  <span className="text-xs text-mute">直販なし</span>
                )}
              </span>
            </Option>
          </div>
        </Group>

        {device.configs.length > 1 && (
          <Group label="構成">
            <div className="flex flex-wrap gap-2">
              <Option on={configId === null} onClick={() => setConfigId(null)}>
                <span className="block text-sm font-medium">すべて</span>
                <span className="block text-[11px] text-mute">{device.rentals.length}件</span>
              </Option>
              {device.configs.map((c) => (
                <Option key={c.id} on={c.id === configId} onClick={() => setConfigId(c.id)}>
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className="block text-[11px] text-mute">
                    {c.officialPrice ? `直販 ${yen(c.officialPrice)}` : `${configCount(c.id)}件`}
                  </span>
                </Option>
              ))}
            </div>
          </Group>
        )}

        {mode === "rent" ? (
          hasRent && (
            <>
              {terms.length > 1 && (
                <Group label="利用期間" hint="各社の料金表の月額で比べます">
                  <div className="flex flex-wrap gap-2">
                    {terms.map((t) => (
                      <Option key={t} on={t === term} onClick={() => setTerm(t)} className="min-w-[72px] text-center">
                        <span className="text-sm font-medium">{t}か月</span>
                      </Option>
                    ))}
                  </div>
                </Group>
              )}
              <Group label="レンタル会社の掲載" hint={`${term}か月で使う場合の月額・安い順`}>
                <ul className="m-0 p-0 list-none border border-line rounded-[12px] divide-y divide-hair overflow-hidden bg-white">
                  {rows.map(({ o, monthly }, i) => {
                    const on = chosen?.o.key === o.key;
                    return (
                      <li key={o.key} className={`flex items-center gap-3 px-3 sm:px-4 py-3 ${on ? "bg-brand-soft/40" : ""}`}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={`${o.companyName}を選ぶ`}
                          disabled={monthly === undefined}
                          onClick={() => setPick(o.key)}
                          className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center cursor-pointer disabled:cursor-default disabled:opacity-30 ${on ? "border-brand" : "border-line"}`}
                        >
                          {on && <span className="size-2 rounded-full bg-brand" />}
                        </button>
                        <SiteIcon src={favicons[o.companyId]} name={o.companyName} size={22} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">
                            {o.companyName}
                            {i === 0 && monthly !== undefined && <span className="ml-2 text-[11px] text-ok">最安</span>}
                          </span>
                          <span className="block text-[11px] text-mute truncate" title={o.title}>
                            {offerSpec(o) || o.title}
                          </span>
                          <span className="block text-[11px] text-faint truncate">
                            {o.minTerm && `${o.minTerm}・`}
                            {TAX_LABEL[o.priceTax]}
                            {o.inStock === false && "・在庫なし"}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <b className="block text-[15px] font-semibold tabular-nums">{monthly !== undefined ? yen(monthly) : "—"}</b>
                          <span className="block text-[10px] text-faint">{monthly !== undefined ? "/月" : `${o.plans[0]?.months}か月〜`}</span>
                        </span>
                        <a
                          href={o.url}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          onClick={() => go(o)}
                          aria-label={`${o.companyName}のページを開く`}
                          className="shrink-0 size-8 rounded-full border border-line flex items-center justify-center text-sub hover:bg-ground hover:no-underline"
                        >
                          <ArrowUpRight size={15} aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                  {!rows.length && <li className="px-4 py-3 text-sm text-mute">この構成の掲載はありません</li>}
                </ul>
              </Group>
            </>
          )
        ) : (
          <Group label="購入先">
            {official && makerUrl ? (
              <a
                href={makerUrl}
                target="_blank"
                rel="noopener"
                onClick={() => track("outbound_click", { kind: "maker", company: device.brandId, device: device.slug })}
                className="flex items-center gap-3 border border-line rounded-[12px] px-4 py-3 bg-white text-ink hover:no-underline hover:bg-ground/60"
              >
                <SiteIcon src={favicons[device.brandId]} name={device.brand} size={22} />
                <span className="flex-1 min-w-0 text-sm font-medium">{device.brand} 公式ストア</span>
                <b className="text-[15px] font-semibold tabular-nums">{yen(official)}</b>
                <ArrowUpRight size={15} className="text-faint" aria-hidden="true" />
              </a>
            ) : (
              <p className="m-0 text-sm text-mute">メーカー直販の価格はありません。</p>
            )}
          </Group>
        )}

        {rb && (
          <p className="m-0 bg-ground rounded-[12px] px-4 py-3 text-[13px] leading-relaxed">
            <b className="font-semibold">{rb.months}か月使うなら{rb.cheaper === "rent" ? "借りる" : "買う"}方が {yen(rb.difference)} 安い</b>
            <span className="block text-xs text-mute">
              レンタル {yen(rb.rentMonthly)}×{rb.months}か月（{rb.rentCompany}・{TAX_LABEL[rb.rentTax]}）と直販価格 {yen(rb.buyPrice)} の単純比較。売却額・保守費用は含みません。
            </span>
          </p>
        )}
      </div>

      {/* 右：申し込み先 */}
      <aside aria-label="申し込み" className="flex flex-col gap-4 xl:sticky xl:top-[124px] xl:self-start">
        <div className="border border-line rounded-[14px] p-4 flex flex-col gap-3 bg-white">
          {mode === "rent" && chosen ? (
            <>
              <p className="m-0 text-[15px] font-semibold inline-flex items-center gap-2">
                <SiteIcon src={favicons[chosen.o.companyId]} name={chosen.o.companyName} size={20} />
                {chosen.o.companyName}
              </p>
              <p className="m-0 text-[13px] text-sub flex flex-col gap-1">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock size={14} className="text-mute" aria-hidden="true" />
                  {chosen.o.minTerm ? `${chosen.o.minTerm}利用できます` : "利用期間は掲載ページで確認"}
                </span>
                {chosen.o.inStock === false && (
                  <span className="inline-flex items-center gap-1.5 text-warn">
                    <PackageX size={14} aria-hidden="true" />
                    掲載ページでは在庫なし
                  </span>
                )}
                {chosen.o.terms && (
                  <span className="inline-flex items-start gap-1.5 text-xs text-mute">
                    <Info size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    {chosen.o.terms}
                  </span>
                )}
              </p>
              <div className="border-t border-hair pt-3">
                <p className="m-0 text-xs text-mute">
                  月額（{term}か月・{TAX_LABEL[chosen.o.priceTax]}）
                </p>
                <p key={chosen.o.key + term} className="m-0 text-[26px] font-semibold tabular-nums leading-tight animate-fade">
                  {yen(chosen.monthly!)}
                </p>
              </div>
              <a
                href={chosen.o.url}
                target="_blank"
                rel="nofollow noopener noreferrer"
                onClick={() => go(chosen.o)}
                className="btn btn-primary w-full !py-3 !rounded-[12px]"
              >
                {chosen.o.companyName}で見る
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </>
          ) : mode === "buy" && official && makerUrl ? (
            <>
              <p className="m-0 text-[15px] font-semibold">{device.brand} 公式ストア</p>
              <a
                href={makerUrl}
                target="_blank"
                rel="noopener"
                onClick={() => track("outbound_click", { kind: "maker", company: device.brandId, device: device.slug })}
                className="btn w-full !py-3 !rounded-[12px] bg-buy text-white hover:bg-[#a83f00] hover:text-white"
              >
                メーカーのサイトで見る
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </>
          ) : (
            <p className="m-0 text-[13px] text-sub inline-flex items-center gap-2">
              <Store size={16} className="text-mute" aria-hidden="true" />
              {mode === "rent" ? "掲載中のレンタル会社はありません" : "直販の価格はありません"}
            </p>
          )}
          <Link href={inquiryHref} onClick={() => track("inquiry_open", { device: device.slug })} className="btn w-full !rounded-[12px] border border-line bg-white text-ink hover:bg-ground">
            <MessageSquare size={15} aria-hidden="true" />
            まとめて相談する（無料）
          </Link>
          {likeSlot}
          <p className="m-0 text-[11px] text-faint leading-relaxed">
            価格は各社の公開ページから取得した掲載価格です。契約・審査・配送は各社が行います。最新の価格・在庫は各社のサイトでご確認ください。
          </p>
        </div>

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

      {/* スマホ：下端に追従するバー */}
      {mode === "rent" && chosen && (
        <div className="xl:hidden sticky bottom-3 z-20 col-span-full">
          <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xl rounded-[16px] shadow-[var(--shadow-lift)] border border-hair px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[11px] text-mute truncate">
                {chosen.o.companyName}・{term}か月・{TAX_LABEL[chosen.o.priceTax]}
              </p>
              <p key={chosen.o.key + term} className="m-0 text-[20px] font-semibold tabular-nums leading-tight animate-fade">
                {yen(chosen.monthly!)}
                <span className="text-xs font-normal text-mute">/月</span>
              </p>
            </div>
            <a href={chosen.o.url} target="_blank" rel="nofollow noopener noreferrer" onClick={() => go(chosen.o)} className="btn btn-primary !py-2.5 !px-5 shrink-0">
              サイトで見る
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
