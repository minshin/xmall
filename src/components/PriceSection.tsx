"use client";

import { useState } from "react";
import { GRADE_CODES, GRADES, RESALE_RATE, TEMPLATE_CODES, TEMPLATES, TERMS } from "@/data/master";
import { yen } from "@/lib/format";
import { findConfig, quote, rentalOffers, rentOrBuy, shopOffers } from "@/lib/pricing";
import type { Device, GradeCode, TemplateCode, Term } from "@/lib/types";

const card = (on: boolean) =>
  `text-left px-3.5 py-3 rounded-[10px] cursor-pointer text-sm leading-normal min-h-11 ${
    on ? "border-2 border-brand bg-brand-soft" : "border border-[#D6D6D0] bg-white"
  }`;

export function PriceSection({ device }: { device: Device }) {
  const [mode, setMode] = useState<"rent" | "buy">("rent");
  const [configId, setConfigId] = useState(device.configs[0].id);
  const [grade, setGrade] = useState<GradeCode>("A");
  const [tpl, setTpl] = useState<TemplateCode>("OFFICE");
  const [term, setTerm] = useState<Term>(24);
  const [qty, setQty] = useState(1);
  const [pick, setPick] = useState<string | null>(null);

  const cfg = findConfig(device, configId);
  const offers = rentalOffers(device, configId, grade, term, tpl);
  const chosen = offers.find((o) => o.supplierId === pick) ?? offers[0];
  const q = chosen ? quote(device, { configId, grade, term, template: tpl, quantity: qty, supplierId: chosen.supplierId }) : undefined;
  const shops = shopOffers(device, configId);
  const rb = rentOrBuy(device, configId, term);
  const verdict = rb
    ? rb.cheaper === "rent"
      ? `${term}か月使うなら、借りる方が約${yen(rb.difference)}安くなります。`
      : `${term}か月使うなら、買う方が約${yen(rb.difference)}安くなります（売却の手間と故障リスクはご自身で負担）。`
    : undefined;

  const tab = (on: boolean) =>
    `px-4 py-2.5 rounded-lg text-sm cursor-pointer min-h-10 ${on ? "bg-white font-bold shadow-sm" : "text-sub"}`;

  return (
    <div className="flex flex-wrap gap-6 items-start">
      <section id="price" aria-labelledby="price-h" className="card p-6 flex flex-col gap-5 flex-[999_1_620px] min-w-0">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h2 id="price-h" className="m-0 text-[19px] font-bold">価格を比べる</h2>
          <div role="tablist" aria-label="借りる・買う" className="flex bg-[#F0F0EC] rounded-[10px] p-1">
            <button type="button" role="tab" aria-selected={mode === "rent"} className={tab(mode === "rent")} onClick={() => setMode("rent")}>
              借りる（レンタル）
            </button>
            <button type="button" role="tab" aria-selected={mode === "buy"} className={tab(mode === "buy")} onClick={() => setMode("buy")}>
              買う（購入）
            </button>
          </div>
        </div>

        <Group title="構成（メモリ／ストレージ）">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
            {device.configs.map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === configId} className={card(c.id === configId)} onClick={() => setConfigId(c.id)}>
                <b>{c.label}</b>
                <br />
                <span className="text-xs text-mute">{c.officialPrice ? `メーカー価格 ${yen(c.officialPrice)}` : (c.note ?? "　")}</span>
              </button>
            ))}
          </div>
        </Group>

        {mode === "rent" ? (
          <>
            <Group title="品質グレード（xmall基準）">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2.5">
                {GRADE_CODES.map((g) => (
                  <button key={g} type="button" aria-pressed={g === grade} className={card(g === grade)} onClick={() => setGrade(g)}>
                    <b>グレード{g}</b>
                    <br />
                    <span className="text-xs text-mute">{GRADES[g].label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 mb-0 text-[13px] bg-brand-soft rounded-[10px] px-3 py-2.5">
                <b>グレード{grade}：</b>外観 {GRADES[grade].appearance} ／ バッテリー最大容量 {GRADES[grade].batteryMin} ／ 保証 {GRADES[grade].warranty}
              </p>
            </Group>

            <Group title="設定テンプレート（届いたらすぐ使える状態にする）">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
                {TEMPLATE_CODES.map((t) => (
                  <button key={t} type="button" aria-pressed={t === tpl} className={card(t === tpl)} onClick={() => setTpl(t)}>
                    <b>{TEMPLATES[t].label}</b>
                    <br />
                    <span className="text-xs text-mute">
                      {TEMPLATES[t].monthlyFee >= 0 ? "+" : "−"}
                      {yen(Math.abs(TEMPLATES[t].monthlyFee))}/月
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATES[tpl].items.map((x) => (
                  <span key={x} className="text-xs bg-white border border-[#D6D6D0] px-2.5 py-1 rounded-full">
                    {x}
                  </span>
                ))}
              </div>
            </Group>

            <div className="flex flex-wrap gap-6">
              <Group title="契約期間">
                <TermPicker term={term} setTerm={setTerm} />
              </Group>
              <Group title="台数">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="1台減らす" className="w-11 h-11 border border-[#D6D6D0] bg-white rounded-[10px] text-lg cursor-pointer" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                    −
                  </button>
                  <span className="min-w-10 text-center text-lg font-bold">{qty}</span>
                  <button type="button" aria-label="1台増やす" className="w-11 h-11 border border-[#D6D6D0] bg-white rounded-[10px] text-lg cursor-pointer" onClick={() => setQty((n) => Math.min(200, n + 1))}>
                    ＋
                  </button>
                </div>
              </Group>
            </div>

            <div>
              <p className="m-0 font-bold text-[15px]">レンタル会社の見積 {offers.length}社</p>
              <div className="overflow-x-auto mt-2.5">
                <table className="w-full border-collapse text-sm min-w-[680px]">
                  <thead>
                    <tr className="text-left text-mute text-xs">
                      {["レンタル会社", "月額/台", "初期費用", "納期", "故障時", "評価", "選択"].map((h) => (
                        <th key={h} className="p-2 border-b border-line font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o, i) => {
                      const on = o.supplierId === chosen?.supplierId;
                      return (
                        <tr key={o.supplierId} className={on ? "bg-brand-soft" : ""}>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">
                            <b>{o.supplierName}</b>
                            <br />
                            <span className="text-[11px] text-ok">{o.certified ? "xmall認定 " : ""}</span>
                            <span className="text-[11px] text-[#9A4A00]">{i === 0 ? "最安" : ""}</span>
                          </td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA] text-lg font-bold">{yen(o.monthly)}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">{o.setupFee ? yen(o.setupFee) : "無料"}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">{o.leadDays}営業日</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">{o.swap}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">★ {o.rating}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">
                            <button
                              type="button"
                              className={`min-h-10 px-3.5 py-2 rounded-lg text-[13px] cursor-pointer ${on ? "bg-brand text-white" : "border border-brand text-brand bg-white"}`}
                              onClick={() => setPick(o.supplierId)}
                            >
                              {on ? "選択中" : "選ぶ"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {offers.length === 0 && <p className="mt-2.5 text-[13px] text-[#9A4A00]">この組み合わせはまだ見積がありません。</p>}
              <p className="mt-2 text-[11px] text-mute">※ レンタル会社名・月額はサンプルです。</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="flex flex-wrap justify-between items-baseline gap-2">
                <p className="m-0 font-bold text-[15px]">新品の販売価格</p>
                <span className="text-[11px] text-mute border border-[#D6D6D0] rounded px-1.5">広告・アフィリエイトリンクを含みます</span>
              </div>
              {shops.length ? (
                <div className="overflow-x-auto mt-2.5">
                  <table className="w-full border-collapse text-sm min-w-[620px]">
                    <thead>
                      <tr className="text-left text-mute text-xs">
                        {["ショップ", "価格（税込）", "ポイント", "実質価格", "お届け", "リンク"].map((h) => (
                          <th key={h} className="p-2 border-b border-line font-normal">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shops.map((s, i) => (
                        <tr key={s.shopId} className={i === 0 ? "bg-buy-soft" : ""}>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">
                            <b>{s.shopName}</b>
                            <br />
                            <span className="text-[11px] text-buy">{i === 0 ? "実質最安 " : ""}</span>
                            <span className="text-[11px] text-mute">{s.note ?? ""}</span>
                          </td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">{yen(s.price)}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">{s.points ? `${s.points.toLocaleString("ja-JP")}pt` : "—"}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA] text-[17px] font-bold">{yen(s.effective)}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">{s.shipping}</td>
                          <td className="px-2 py-3 border-b border-[#EEEEEA]">
                            {/* TODO: 各ショップのアフィリエイトURLに差し替え */}
                            <a href="#price" rel="sponsored nofollow" className="inline-block border border-buy text-buy px-3 py-2 rounded-lg no-underline text-[13px]">
                              ショップで見る
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2.5 text-sm text-sub">この機種のショップ価格は準備中です。</p>
              )}
              <p className="mt-2 text-[11px] text-mute">メーカー価格は発表時点。他ショップの価格・ポイントはサンプルで、実運用では各ショップのAPIから毎日更新します。</p>
            </div>

            {rb && (
              <div className="bg-[#F7F7F4] rounded-[14px] px-4 py-4 flex flex-col gap-3">
                <p className="m-0 font-bold text-[15px]">買うのと借りる、どちらが得？</p>
                <div className="flex gap-2 items-center flex-wrap text-[13px]">
                  <span>使う期間</span>
                  <TermPicker term={term} setTerm={setTerm} />
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5 text-[13px]">
                  <div className="bg-white rounded-[10px] px-3.5 py-3 leading-loose">
                    <b>買う場合</b>
                    <br />
                    購入（実質） {yen(rb.buyEffective)}
                    <br />− {term}か月後の売却見込み {yen(rb.resale)}
                    <br />＝ <b className="text-base">{yen(rb.buyNet)}</b>
                  </div>
                  <div className="bg-white rounded-[10px] px-3.5 py-3 leading-loose">
                    <b>借りる場合（最安・グレードA）</b>
                    <br />
                    {yen(rb.rentMonthly)} × {term}か月
                    <br />
                    故障時の交換・返却時のデータ消去込み
                    <br />＝ <b className="text-base">{yen(rb.rentTotal)}</b>
                  </div>
                </div>
                <p className="m-0 text-sm bg-brand-soft rounded-[10px] px-3 py-2.5">
                  <b>{verdict}</b>
                </p>
                <p className="m-0 text-[11px] text-mute">
                  売却見込みは仮定の残価率（{TERMS.map((t) => `${t}か月${Math.round(RESALE_RATE[t] * 100)}%`).join("・")}）による試算です。経費処理の扱いは税理士にご確認ください。
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <aside aria-label="見積サマリー" className="card p-6 flex flex-col gap-3 flex-[1_1_300px] max-w-[360px]">
        {mode === "rent" ? (
          <>
            <p className="m-0 text-[13px] text-mute">レンタルの見積</p>
            <p className="m-0 font-bold leading-relaxed">
              {cfg.label}
              <br />
              グレード{grade} ／ {TEMPLATES[tpl].label} ／ {term}か月
            </p>
            <dl className="border-t border-[#EEEEEA] pt-3 m-0 flex flex-col gap-1.5 text-sm">
              <Row k="レンタル会社" v={chosen?.supplierName ?? "—"} />
              <Row k="月額/台" v={chosen ? yen(chosen.monthly) : "—"} />
              <Row k="台数" v={`${qty}台`} />
              <div className="flex justify-between text-lg mt-1.5">
                <dt>月額合計</dt>
                <dd className="m-0 font-bold">{q ? yen(q.monthlyTotal) : "—"}</dd>
              </div>
              <Row k="契約期間の総額（初期費用込み）" v={q ? yen(q.contractTotal) : "—"} muted />
            </dl>
            {/* TODO: 申込フローとレンタル会社への送客 */}
            <a href="#price" className="bg-brand text-white text-center no-underline py-3.5 rounded-[10px] font-bold">
              この内容で問い合わせる
            </a>
            <p className="m-0 text-[11px] text-mute">審査・契約・配送は選んだレンタル会社が行います。</p>
          </>
        ) : shops.length ? (
          <>
            <p className="m-0 text-[13px] text-mute">いちばん安く買えるショップ</p>
            <p className="m-0 font-bold text-lg">{shops[0].shopName}</p>
            <p className="m-0 text-sm">
              {cfg.label}
              <br />
              実質 <b className="text-[22px]">{yen(shops[0].effective)}</b>
            </p>
            <a href="#price" rel="sponsored nofollow" className="bg-buy text-white text-center no-underline py-3.5 rounded-[10px] font-bold">
              {shops[0].shopName}で見る
            </a>
            {verdict && <p className="m-0 text-xs bg-brand-soft rounded-[10px] px-3 py-2.5 leading-relaxed">{verdict}</p>}
            <p className="m-0 text-[11px] text-mute">購入はショップのサイトで行います。xmallはショップから紹介料を受け取ることがあります。</p>
          </>
        ) : (
          <p className="m-0 text-sm text-sub">ショップ価格は準備中です。</p>
        )}
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="m-0 mb-2 font-bold text-sm">{title}</p>
      {children}
    </div>
  );
}

function TermPicker({ term, setTerm }: { term: Term; setTerm: (t: Term) => void }) {
  return (
    <div className="flex gap-2">
      {TERMS.map((t) => (
        <button key={t} type="button" aria-pressed={t === term} className={card(t === term)} onClick={() => setTerm(t)}>
          {t}か月
        </button>
      ))}
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${muted ? "text-mute" : ""}`}>
      <dt>{k}</dt>
      <dd className="m-0 font-bold">{v}</dd>
    </div>
  );
}
