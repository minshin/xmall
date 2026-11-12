"use client";

import Link from "next/link";
import {
  ArrowUpRight, BadgeCheck, BatteryFull, Box, Briefcase, Code2, Coins, Info, Minus, Palette, Plus, RefreshCw, ShieldCheck,
  Sparkles, Star, Truck,
} from "lucide-react";
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

const TEMPLATE_ICON: Record<TemplateCode, typeof Briefcase> = { OFFICE: Briefcase, DESIGN: Palette, DEV: Code2, NONE: Box };

export function PriceSection({ device, listed = [], favicons = {} }: { device: Device; listed?: ListedOffer[]; favicons?: Record<string, string> }) {
  const [mode, setMode] = useState<"rent" | "buy">("rent");
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
  const rb = rentOrBuy(device, configId, term);
  const brandIcon = device.brandId;

  return (
    <div id="price" className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] items-start scroll-mt-28">
      <section aria-label="価格を比べる" className="card p-5 sm:p-7 flex flex-col gap-6 min-w-0">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h2 className="m-0 text-[24px] font-semibold">価格</h2>
          <div role="tablist" aria-label="借りる・買う" className="flex bg-ground rounded-full p-1">
            {(
              [
                ["rent", "借りる"],
                ["buy", "買う"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={mode === k}
                onClick={() => setMode(k)}
                className={`px-5 py-1.5 rounded-full text-sm cursor-pointer transition-all ${mode === k ? "bg-white shadow-sm font-medium" : "text-mute"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <Field label="構成">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            {device.configs.map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === configId} className="seg px-4 py-3 text-left" onClick={() => setConfigId(c.id)}>
                <span className="block text-[15px] font-medium">{c.label}</span>
                {c.officialPrice && <span className="block text-xs text-mute mt-0.5">{yen(c.officialPrice)}</span>}
              </button>
            ))}
          </div>
        </Field>

        {mode === "rent" ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="品質グレード">
                <div className="grid grid-cols-4 gap-1.5">
                  {GRADE_CODES.map((g) => (
                    <button key={g} type="button" aria-pressed={g === grade} title={GRADES[g].label} className="seg py-2 text-[15px] font-medium" onClick={() => setGrade(g)}>
                      {g}
                    </button>
                  ))}
                </div>
                <p key={grade} className="m-0 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mute animate-fade">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={13} aria-hidden="true" />
                    {GRADES[grade].label}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BatteryFull size={13} aria-hidden="true" />
                    {GRADES[grade].batteryMin}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={13} aria-hidden="true" />
                    保証 {GRADES[grade].warranty}
                  </span>
                </p>
              </Field>
              <Field label="セットアップ">
                <div className="grid grid-cols-4 gap-1.5">
                  {TEMPLATE_CODES.map((t) => {
                    const Icon = TEMPLATE_ICON[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={t === tpl}
                        title={TEMPLATES[t].items.join("・")}
                        className="seg py-2 flex flex-col items-center gap-1 text-[11px]"
                        onClick={() => setTpl(t)}
                      >
                        <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                        {TEMPLATES[t].label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="期間">
                <TermPicker term={term} setTerm={setTerm} />
              </Field>
              <Field label="台数">
                <div className="inline-flex items-center bg-ground rounded-full p-1">
                  <button type="button" aria-label="1台減らす" className="size-9 rounded-full bg-white flex items-center justify-center cursor-pointer active:scale-95 transition" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                    <Minus size={16} />
                  </button>
                  <span key={qty} className="w-12 text-center text-[17px] font-medium tabular-nums animate-fade">
                    {qty}
                  </span>
                  <button type="button" aria-label="1台増やす" className="size-9 rounded-full bg-white flex items-center justify-center cursor-pointer active:scale-95 transition" onClick={() => setQty((n) => Math.min(200, n + 1))}>
                    <Plus size={16} />
                  </button>
                </div>
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="m-0 text-[13px] font-medium text-mute">レンタル会社 {offers.length}社</p>
                <span className="text-[11px] bg-warn-soft text-warn rounded-full px-2 py-0.5">サンプル</span>
              </div>
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {offers.map((o, i) => {
                  const on = o.supplierId === chosen?.supplierId;
                  return (
                    <li key={o.supplierId}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPick(o.supplierId)}
                        className="seg w-full px-4 py-3 flex items-center gap-3 text-left"
                      >
                        <SiteIcon src={favicons[o.supplierId]} name={o.supplierName} size={28} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 text-[15px] font-medium">
                            {o.supplierName}
                            {o.certified && <BadgeCheck size={15} className="text-brand" aria-label="xmall認定" />}
                            {i === 0 && <span className="text-[10px] font-semibold text-buy">最安</span>}
                          </span>
                          <span className="flex flex-wrap gap-x-3 text-xs text-mute mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <Truck size={12} aria-hidden="true" />
                              {o.leadDays}日
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
                        <span className="text-right">
                          <b key={o.monthly} className="block text-[19px] font-semibold tabular-nums animate-fade">
                            {yen(o.monthly)}
                          </b>
                          <span className="text-[11px] text-faint">/月{o.setupFee ? `・初期${yen(o.setupFee)}` : ""}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {offers.length === 0 && <p className="m-0 text-[13px] text-warn">この条件の見積はまだありません</p>}
            </div>

            {listed.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="m-0 text-[13px] font-medium text-mute inline-flex items-center gap-1.5">
                  各社の掲載価格
                  <span title="各社の公開ページから取得した価格です。提携先ではありません。最新の条件は各社サイトでご確認ください。" className="inline-flex text-faint cursor-help">
                    <Info size={13} aria-label="説明" />
                  </span>
                </p>
                <ul className="m-0 p-0 list-none rounded-[12px] bg-ground divide-y divide-white">
                  {(moreListed ? listed : listed.slice(0, 4)).map((l) => (
                    <li key={l.key} className="animate-fade">
                      <a href={l.url} target="_blank" rel="nofollow noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 text-ink hover:no-underline hover:bg-hair/60 transition-colors rounded-[12px]">
                        <SiteIcon src={favicons[l.companyId]} name={l.companyName} size={20} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{l.companyName}</span>
                          <span className="block text-[11px] text-faint truncate">
                            {l.spec}
                            {l.inStock === false ? "・在庫なし" : ""}
                          </span>
                        </span>
                        <span className="text-right">
                          <b className="text-[15px] font-semibold tabular-nums">{yen(l.monthly)}</b>
                          <span className="block text-[10px] text-faint">{l.note}</span>
                        </span>
                        <ArrowUpRight size={15} className="text-faint" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
                {listed.length > 4 && (
                  <button type="button" className="self-start text-[13px] text-link cursor-pointer" onClick={() => setMoreListed((v) => !v)}>
                    {moreListed ? "閉じる" : `すべて表示（${listed.length}）`}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="m-0 text-[13px] font-medium text-mute">新品</p>
                <span className="text-[11px] text-faint border border-line rounded-full px-2 py-0.5">広告</span>
              </div>
              {shops.length ? (
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {shops.map((s, i) => (
                    <li key={s.shopId}>
                      {/* TODO: 各ショップのアフィリエイトURLに差し替え */}
                      <a href="#price" rel="sponsored nofollow" className="seg px-4 py-3 flex items-center gap-3 text-ink hover:no-underline">
                        <SiteIcon src={favicons[s.shopId === "official" ? brandIcon : s.shopId]} name={s.shopName} size={28} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 text-[15px] font-medium">
                            {s.shopName}
                            {i === 0 && <span className="text-[10px] font-semibold text-buy">実質最安</span>}
                          </span>
                          <span className="flex flex-wrap gap-x-3 text-xs text-mute mt-0.5">
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
                        <span className="text-right">
                          <b className="block text-[19px] font-semibold tabular-nums">{yen(s.effective)}</b>
                          {s.points > 0 && <span className="text-[11px] text-faint line-through">{yen(s.price)}</span>}
                        </span>
                        <ArrowUpRight size={16} className="text-faint" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-mute">準備中</p>
              )}
              <p className="m-0 text-[11px] text-faint">メーカー価格は発表時点。他ショップはサンプル。</p>
            </div>

            {rb && (
              <div className="bg-ground rounded-[14px] p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="m-0 font-semibold">買う vs 借りる</p>
                  <TermPicker term={term} setTerm={setTerm} />
                </div>
                <CompareBars buy={rb.buyNet} rent={rb.rentTotal} />
                <p key={`${rb.cheaper}${term}`} className="m-0 text-sm animate-fade">
                  {term}か月なら <b className={rb.cheaper === "rent" ? "text-brand" : "text-buy"}>{rb.cheaper === "rent" ? "借りる" : "買う"}</b> 方が{" "}
                  <b>{yen(rb.difference)}</b> お得
                </p>
                <p className="m-0 text-[11px] text-faint">購入は売却見込み（仮定の残価率）を差し引いた額。税務は税理士へ。</p>
              </div>
            )}
          </>
        )}
      </section>

      <aside aria-label="見積サマリー" className="card p-6 flex flex-col gap-4 lg:sticky lg:top-28">
        {mode === "rent" ? (
          <>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[cfg.label, `グレード${grade}`, TEMPLATES[tpl].label, `${term}か月`].map((x) => (
                <span key={x} className="bg-ground rounded-full px-2.5 py-1 text-sub">
                  {x}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-sub">
              {chosen && <SiteIcon src={favicons[chosen.supplierId]} name={chosen.supplierName} size={18} />}
              {chosen?.supplierName ?? "—"}
            </div>
            <div>
              <p className="m-0 text-xs text-mute">月額合計（{qty}台）</p>
              <p key={q?.monthlyTotal} className="m-0 text-[34px] font-semibold tabular-nums leading-tight animate-fade">
                {q ? yen(q.monthlyTotal) : "—"}
              </p>
              <p className="m-0 text-xs text-faint tabular-nums">総額 {q ? yen(q.contractTotal) : "—"}</p>
            </div>
            {chosen ? (
              <Link
                href={`/inquiry?${new URLSearchParams({
                  device: device.slug,
                  config: configId,
                  grade,
                  term: String(term),
                  template: tpl,
                  qty: String(qty),
                  supplier: chosen.supplierId,
                })}`}
                className="btn btn-primary w-full"
              >
                見積を依頼
              </Link>
            ) : (
              <span className="btn w-full bg-hair text-faint cursor-not-allowed">対応する会社がありません</span>
            )}
          </>
        ) : shops.length ? (
          <>
            <div className="flex items-center gap-2 text-sm text-sub">
              <SiteIcon src={favicons[shops[0].shopId === "official" ? brandIcon : shops[0].shopId]} name={shops[0].shopName} size={18} />
              {shops[0].shopName}
            </div>
            <div>
              <p className="m-0 text-xs text-mute">実質価格</p>
              <p key={shops[0].effective} className="m-0 text-[34px] font-semibold tabular-nums leading-tight animate-fade">
                {yen(shops[0].effective)}
              </p>
              <p className="m-0 text-xs text-faint">{cfg.label}</p>
            </div>
            <a href="#price" rel="sponsored nofollow" className="btn w-full bg-buy text-white hover:bg-[#a83f00] hover:text-white">
              ショップで見る
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </>
        ) : (
          <p className="m-0 text-sm text-mute">ショップ価格は準備中</p>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="m-0 mb-2 text-[13px] font-medium text-mute">{label}</p>
      {children}
    </div>
  );
}

function TermPicker({ term, setTerm }: { term: Term; setTerm: (t: Term) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 w-full sm:min-w-[200px] sm:w-auto">
      {TERMS.map((t) => (
        <button key={t} type="button" aria-pressed={t === term} className="seg py-2 text-sm" onClick={() => setTerm(t)}>
          {t}か月
        </button>
      ))}
    </div>
  );
}

/** 買う・借りるの総額を横棒で比べる */
function CompareBars({ buy, rent }: { buy: number; rent: number }) {
  const max = Math.max(buy, rent) || 1;
  const rows = [
    { label: "借りる", value: rent, color: "bg-brand" },
    { label: "買う", value: buy, color: "bg-buy" },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 text-sm">
          <span className="text-mute">{r.label}</span>
          <span className="h-2.5 bg-white rounded-full overflow-hidden">
            <span className={`block h-full rounded-full ${r.color} transition-[width] duration-500 ease-out`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <b className="font-semibold tabular-nums">{yen(r.value)}</b>
        </div>
      ))}
    </div>
  );
}
