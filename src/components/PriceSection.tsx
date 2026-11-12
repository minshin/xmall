"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, ChevronDown, Coins, Info, Minus, Plus, RefreshCw, Star, Truck } from "lucide-react";
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

/** Apple 風のセグメントコントロール */
function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex bg-hair rounded-[10px] p-0.5 w-full sm:w-auto">
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={v === value}
          onClick={() => onChange(v)}
          className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-[8px] text-[13px] cursor-pointer transition-all whitespace-nowrap ${
            v === value ? "bg-white shadow-sm font-medium text-ink" : "text-sub hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">{children}</div>;
const RowLabel = ({ children }: { children: React.ReactNode }) => <span className="w-24 shrink-0 text-[13px] text-mute">{children}</span>;

export function PriceSection({ device, listed = [], favicons = {} }: { device: Device; listed?: ListedOffer[]; favicons?: Record<string, string> }) {
  const [mode, setMode] = useState<"rent" | "buy">("rent");
  const [configId, setConfigId] = useState(device.configs[0].id);
  const [grade, setGrade] = useState<GradeCode>("A");
  const [tpl, setTpl] = useState<TemplateCode>("OFFICE");
  const [term, setTerm] = useState<Term>(24);
  const [qty, setQty] = useState(1);
  const [pick, setPick] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [moreListed, setMoreListed] = useState(false);

  const cfg = findConfig(device, configId);
  const offers = rentalOffers(device, configId, grade, term, tpl);
  const chosen = offers.find((o) => o.supplierId === pick) ?? offers[0];
  const q = chosen ? quote(device, { configId, grade, term, template: tpl, quantity: qty, supplierId: chosen.supplierId }) : undefined;
  const shops = shopOffers(device, configId);
  const rb = rentOrBuy(device, configId, term);
  const brandIcon = device.brandId;
  const inquiryHref = chosen
    ? `/inquiry?${new URLSearchParams({ device: device.slug, config: configId, grade, term: String(term), template: tpl, qty: String(qty), supplier: chosen.supplierId })}`
    : null;

  const total = mode === "rent" ? q?.monthlyTotal : shops[0]?.effective;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="price-h" className="m-0 text-[32px] sm:text-[40px] font-semibold leading-tight">
          借りる、買う。
          <span className="block text-mute">いちばん合うのは？</span>
        </h2>
        <Segmented
          label="借りる・買う"
          value={mode}
          onChange={setMode}
          options={[
            ["rent", "借りる"],
            ["buy", "買う"],
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {/* 構成 */}
          <div className="flex gap-2 overflow-x-auto snap-x-strip -mx-4 px-4 sm:mx-0 sm:px-0 py-1">
            {device.configs.map((c) => {
              const on = c.id === configId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setConfigId(c.id)}
                  className={`shrink-0 text-left rounded-[14px] px-4 py-3 cursor-pointer transition-all ${on ? "bg-white shadow-[inset_0_0_0_2px_var(--color-brand)]" : "bg-white/60 hover:bg-white"}`}
                >
                  <span className="block text-[15px] font-medium whitespace-nowrap">{c.label}</span>
                  {c.officialPrice && <span className="block text-xs text-mute mt-0.5">{yen(c.officialPrice)}</span>}
                </button>
              );
            })}
          </div>

          {mode === "rent" ? (
            <>
              {/* 条件（1行で要約、開いて変更） */}
              <div className="bg-white rounded-[20px]">
                <button
                  type="button"
                  aria-expanded={editing}
                  onClick={() => setEditing((v) => !v)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer"
                >
                  <span className="flex-1 min-w-0 text-[15px] flex flex-wrap items-baseline">
                    <span className="hidden sm:inline text-mute text-[13px] mr-1">条件</span>
                    {[`グレード${grade}`, TEMPLATES[tpl].label, `${term}か月`, `${qty}台`].map((t, k) => (
                      <span key={t} className="whitespace-nowrap">
                        {k > 0 && <span className="text-faint">・</span>}
                        {t}
                      </span>
                    ))}
                  </span>
                  <span className="text-[13px] text-link whitespace-nowrap">{editing ? "閉じる" : "変更"}</span>
                  <ChevronDown size={16} className={`text-faint transition-transform ${editing ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {editing && (
                  <div className="px-5 pb-5 flex flex-col gap-4 border-t border-hair pt-4 animate-fade">
                    <Row>
                      <RowLabel>品質グレード</RowLabel>
                      <Segmented label="品質グレード" value={grade} onChange={setGrade} options={GRADE_CODES.map((g) => [g, `${g}・${GRADES[g].label}`])} />
                    </Row>
                    <Row>
                      <RowLabel>セットアップ</RowLabel>
                      <Segmented label="セットアップ" value={tpl} onChange={setTpl} options={TEMPLATE_CODES.map((t) => [t, TEMPLATES[t].label])} />
                    </Row>
                    <Row>
                      <RowLabel>期間</RowLabel>
                      <Segmented label="期間" value={term} onChange={setTerm} options={TERMS.map((t) => [t, `${t}か月`])} />
                    </Row>
                    <Row>
                      <RowLabel>台数</RowLabel>
                      <span className="inline-flex items-center bg-hair rounded-[10px] p-0.5 self-start">
                        <button type="button" aria-label="1台減らす" className="size-8 rounded-[8px] hover:bg-white flex items-center justify-center cursor-pointer" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                          <Minus size={15} />
                        </button>
                        <span key={qty} className="w-10 text-center text-[15px] font-medium tabular-nums animate-fade">
                          {qty}
                        </span>
                        <button type="button" aria-label="1台増やす" className="size-8 rounded-[8px] hover:bg-white flex items-center justify-center cursor-pointer" onClick={() => setQty((n) => Math.min(200, n + 1))}>
                          <Plus size={15} />
                        </button>
                      </span>
                    </Row>
                    <p className="m-0 text-xs text-mute">
                      グレード{grade}：{GRADES[grade].appearance}／バッテリー {GRADES[grade].batteryMin}／保証 {GRADES[grade].warranty}
                    </p>
                  </div>
                )}
              </div>

              {/* レンタル会社 */}
              <section aria-label="レンタル会社の見積" className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="m-0 text-[13px] font-medium text-mute">レンタル会社 {offers.length}社</h3>
                  <span className="text-[11px] bg-warn-soft text-warn rounded-full px-2 py-0.5">サンプル</span>
                </div>
                <ul className="m-0 p-0 list-none bg-white rounded-[20px] divide-y divide-hair overflow-hidden">
                  {offers.map((o, i) => {
                    const on = o.supplierId === chosen?.supplierId;
                    return (
                      <li key={o.supplierId}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setPick(o.supplierId)}
                          className={`w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer transition-colors ${on ? "bg-brand-soft/60" : "hover:bg-ground/60"}`}
                        >
                          <span className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${on ? "border-brand" : "border-line"}`}>
                            {on && <span className="size-2.5 rounded-full bg-brand animate-pop" />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5 text-[15px] font-medium">
                              <span className="truncate">{o.supplierName}</span>
                              {o.certified && <BadgeCheck size={15} className="text-brand shrink-0" aria-label="xmall認定" />}
                            </span>
                            <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-mute mt-1">
                              {i === 0 && <span className="text-ok font-medium">最安</span>}
                              <span className="inline-flex items-center gap-1">
                                <Truck size={12} aria-hidden="true" />
                                {o.leadDays}営業日
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <RefreshCw size={12} aria-hidden="true" />
                                {o.swap}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Star size={12} aria-hidden="true" />
                                {o.rating}
                              </span>
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <b key={o.monthly} className="block text-[19px] font-semibold tabular-nums animate-fade">
                              {yen(o.monthly)}
                            </b>
                            <span className="block text-[11px] text-faint">{o.setupFee ? `初期 ${yen(o.setupFee)}` : "初期費用なし"}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {offers.length === 0 && <li className="px-5 py-4 text-[13px] text-warn">この条件の見積はまだありません</li>}
                </ul>
              </section>

              {listed.length > 0 && (
                <section aria-label="他社サイトの掲載価格" className="flex flex-col gap-2">
                  <h3 className="m-0 px-1 text-[13px] font-medium text-mute inline-flex items-center gap-1.5">
                    他社サイトの掲載価格
                    <span title="各社の公開ページから取得した価格です。提携先ではありません。最新の条件は各社サイトでご確認ください。" className="inline-flex text-faint cursor-help">
                      <Info size={13} aria-label="説明" />
                    </span>
                  </h3>
                  <ul className="m-0 p-0 list-none bg-white rounded-[20px] divide-y divide-hair overflow-hidden">
                    {(moreListed ? listed : listed.slice(0, 3)).map((l) => (
                      <li key={l.key}>
                        <a href={l.url} target="_blank" rel="nofollow noopener noreferrer" className="flex items-center gap-4 px-5 py-3.5 text-ink hover:no-underline hover:bg-ground/60 transition-colors">
                          <SiteIcon src={favicons[l.companyId]} name={l.companyName} size={22} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm truncate">{l.companyName}</span>
                            <span className="block text-[11px] text-faint truncate">
                              {l.spec}・{l.note}
                              {l.inStock === false ? "・在庫なし" : ""}
                            </span>
                          </span>
                          <b className="text-[15px] font-semibold tabular-nums shrink-0">{yen(l.monthly)}</b>
                          <ArrowUpRight size={15} className="text-faint shrink-0" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                  {listed.length > 3 && (
                    <button type="button" className="self-start px-1 text-[13px] text-link cursor-pointer" onClick={() => setMoreListed((v) => !v)}>
                      {moreListed ? "閉じる" : `すべて表示（${listed.length}）`}
                    </button>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              <section aria-label="購入価格" className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="m-0 text-[13px] font-medium text-mute">新品の購入先</h3>
                  <span className="text-[11px] text-faint border border-line rounded-full px-2 py-0.5">広告</span>
                </div>
                {shops.length ? (
                  <ul className="m-0 p-0 list-none bg-white rounded-[20px] divide-y divide-hair overflow-hidden">
                    {shops.map((s, i) => (
                      <li key={s.shopId}>
                        {/* TODO: 各ショップのアフィリエイトURLに差し替え */}
                        <a href="#price" rel="sponsored nofollow" className="flex items-center gap-4 px-5 py-4 text-ink hover:no-underline hover:bg-ground/60 transition-colors">
                          <SiteIcon src={favicons[s.shopId === "official" ? brandIcon : s.shopId]} name={s.shopName} size={26} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[15px] font-medium truncate">{s.shopName}</span>
                            <span className="flex flex-wrap gap-x-3 text-xs text-mute mt-1">
                              {i === 0 && <span className="text-ok font-medium">実質最安</span>}
                              {s.points > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Coins size={12} aria-hidden="true" />
                                  {s.points.toLocaleString("ja-JP")}pt
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Truck size={12} aria-hidden="true" />
                                {s.shipping}
                              </span>
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <b className="block text-[19px] font-semibold tabular-nums">{yen(s.effective)}</b>
                            {s.points > 0 && <span className="text-[11px] text-faint line-through">{yen(s.price)}</span>}
                          </span>
                          <ArrowUpRight size={16} className="text-faint shrink-0" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 px-1 text-sm text-mute">購入価格は準備中です</p>
                )}
                <p className="m-0 px-1 text-[11px] text-faint">メーカー価格は発表時点。他ショップの価格はサンプル。</p>
              </section>

              {rb && (
                <section aria-label="買う vs 借りる" className="bg-white rounded-[20px] p-5 sm:p-6 flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="m-0 text-[17px] font-semibold">買う vs 借りる</h3>
                    <Segmented label="使う期間" value={term} onChange={setTerm} options={TERMS.map((t) => [t, `${t}か月`])} />
                  </div>
                  <CompareBars buy={rb.buyNet} rent={rb.rentTotal} />
                  <p key={`${rb.cheaper}${term}`} className="m-0 text-[15px] animate-fade">
                    {term}か月なら <b className={rb.cheaper === "rent" ? "text-brand" : "text-buy"}>{rb.cheaper === "rent" ? "借りる" : "買う"}</b> 方が <b>{yen(rb.difference)}</b> お得
                  </p>
                  <p className="m-0 text-[11px] text-faint">購入は売却見込み（仮定の残価率）を差し引いた額。税務は税理士へ。</p>
                </section>
              )}
            </>
          )}
        </div>

        {/* まとめ（PC は右に固定、スマホは価格欄の下端に追従） */}
        <aside aria-label="見積サマリー" className="hidden lg:flex flex-col gap-5 bg-white rounded-[20px] p-6 sticky top-28">
          <Summary mode={mode} label={cfg.label} total={total} sub={mode === "rent" ? (q ? `総額 ${yen(q.contractTotal)}・${chosen?.supplierName}` : undefined) : shops[0]?.shopName} />
          <Cta mode={mode} href={inquiryHref} hasShop={shops.length > 0} />
        </aside>
      </div>

      <div className="lg:hidden sticky bottom-3 z-20 -mx-1">
        <div className="flex items-center gap-3 bg-white/85 backdrop-blur-xl rounded-[18px] shadow-[var(--shadow-lift)] px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="m-0 text-[11px] text-mute truncate">
              {cfg.label}
              {mode === "rent" ? `・${qty}台・月額` : "・実質"}
            </p>
            <p key={total} className="m-0 text-[22px] font-semibold tabular-nums leading-tight animate-fade">
              {total ? yen(total) : "—"}
            </p>
          </div>
          <Cta mode={mode} href={inquiryHref} hasShop={shops.length > 0} compact />
        </div>
      </div>
    </div>
  );
}

function Summary({ mode, label, total, sub }: { mode: "rent" | "buy"; label: string; total?: number; sub?: string }) {
  return (
    <div>
      <p className="m-0 text-[13px] text-mute">{label}</p>
      <p className="m-0 mt-1 text-xs text-faint">{mode === "rent" ? "月額合計" : "実質価格"}</p>
      <p key={total} className="m-0 text-[40px] font-semibold tabular-nums leading-none mt-1 animate-fade">
        {total ? yen(total) : "—"}
      </p>
      {sub && <p className="m-0 mt-2 text-xs text-mute">{sub}</p>}
    </div>
  );
}

function Cta({ mode, href, hasShop, compact }: { mode: "rent" | "buy"; href: string | null; hasShop: boolean; compact?: boolean }) {
  const size = compact ? "!py-2.5 !px-5 !text-[15px] shrink-0" : "w-full !py-3";
  if (mode === "rent")
    return href ? (
      <Link href={href} className={`btn btn-primary ${size}`}>
        見積を依頼
      </Link>
    ) : (
      <span className={`btn bg-hair text-faint cursor-not-allowed ${size}`}>対応する会社なし</span>
    );
  return hasShop ? (
    <a href="#price" rel="sponsored nofollow" className={`btn bg-buy text-white hover:bg-[#a83f00] hover:text-white ${size}`}>
      ショップへ
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  ) : (
    <span className={`btn bg-hair text-faint ${size}`}>準備中</span>
  );
}

/** 買う・借りるの総額を横棒で比べる */
function CompareBars({ buy, rent }: { buy: number; rent: number }) {
  const max = Math.max(buy, rent) || 1;
  return (
    <div className="flex flex-col gap-3">
      {[
        { label: "借りる", value: rent, color: "bg-brand" },
        { label: "買う", value: buy, color: "bg-buy" },
      ].map((r) => (
        <div key={r.label} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 text-sm">
          <span className="text-mute">{r.label}</span>
          <span className="h-2 bg-hair rounded-full overflow-hidden">
            <span className={`block h-full rounded-full ${r.color} transition-[width] duration-500 ease-out`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <b className="font-semibold tabular-nums">{yen(r.value)}</b>
        </div>
      ))}
    </div>
  );
}
