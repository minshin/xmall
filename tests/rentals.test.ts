import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { capacitiesFromTitle, capacityGb, cpuFromText, detectMaker, htmlToLines, parseTerm } from "../scripts/rentals/lib";
import { checkPattern, matchListing, type MatchProduct } from "../src/lib/rental-match";
import { SEED_CATALOG } from "../src/lib/seed";
import { parse as parseBusters } from "../scripts/rentals/sites/busters";
import { parse as parseRentio } from "../scripts/rentals/sites/rentio";
import { parse as parseTamaya } from "../scripts/rentals/sites/tamaya";
import type { RentalDataFile } from "../scripts/rentals/config";

describe("スクレイピングの共通処理", () => {
  test("期間の表記を日・月に揃える", () => {
    assert.deepEqual(parseTerm("3日間"), { unit: "day", value: 3 });
    assert.deepEqual(parseTerm("~3ヶ月"), { unit: "month", value: 3 });
    assert.deepEqual(parseTerm("24ヵ月"), { unit: "month", value: 24 });
    assert.deepEqual(parseTerm("1年"), { unit: "month", value: 12 });
    assert.equal(parseTerm("価格"), null);
  });

  test("容量は GB に揃え、範囲表記は推測しない", () => {
    assert.equal(capacityGb("16GB"), 16);
    assert.equal(capacityGb("512GB SSD (M.2)"), 512);
    assert.equal(capacityGb("1TB"), 1024);
    assert.equal(capacityGb("8~16GB"), null);
    assert.deepEqual(capacitiesFromTitle("MacBook Pro 14インチ (M5, 2025) / 512GB SSD /16GB /シルバー"), { memoryGb: 16, storageGb: 512 });
    assert.deepEqual(capacitiesFromTitle("V14 Gen4 (メモリ8GB/256GB SSD/Windows 11 Pro)"), { memoryGb: 8, storageGb: 256 });
  });

  test("メーカー判定は「モデル」の「デル」などに反応しない", () => {
    assert.equal(detectMaker("ハイエンドモデル01 B5ノートパソコン"), null);
    assert.equal(detectMaker("DELL Latitude 3550"), "Dell");
    assert.equal(detectMaker("レッツノート CF-SV9"), "Panasonic");
    assert.equal(cpuFromText("ThinkPad X1 Carbon Core Ultra 7 155U"), "Core Ultra 7 155U");
    assert.equal(cpuFromText("MacBook Pro 14インチ (M5, 2025)"), "M5");
  });

  test("カタログ機種への対応づけは世代まで一致したものだけ（products.listing_match）", () => {
    const products: MatchProduct[] = SEED_CATALOG.filter((d) => d.listingMatch).map((d) => ({
      slug: d.slug,
      listingMatch: d.listingMatch!,
      variants: d.configs.map((c) => ({ code: c.id, attrs: c.attrs })),
    }));
    const m = (title: string, memoryGb: number | null = null, storageGb: number | null = null) => {
      const r = matchListing(products, { title, maker: null, model: null, memoryGb, storageGb });
      return { deviceSlug: r.deviceSlug, configId: r.configId };
    };
    assert.deepEqual(m("MacBook Pro 14インチ (M5, 2025) 512GB SSD", 16, 512), { deviceSlug: "macbook-pro-14-m5", configId: "16-512" });
    assert.deepEqual(m("MacBook Pro 14インチ M5 Pro"), { deviceSlug: null, configId: null });
    assert.deepEqual(m("ThinkPad X1 Carbon Gen 13 Aura Edition"), { deviceSlug: "thinkpad-x1-carbon", configId: null });
    assert.deepEqual(m("ThinkPad X1 Carbon Gen8"), { deviceSlug: null, configId: null });
    assert.deepEqual(m("MacBook Air 13インチ 2018年モデル"), { deviceSlug: null, configId: null });
    assert.deepEqual(m("Ｌｅｔ’ｓ ｎｏｔｅ ＣＦ-ＳＲ４"), { deviceSlug: "lets-note-sr", configId: null }, "全角は NFKC で揃えてから当てる");
  });

  test("構成：ストレージの記載が無ければ、メモリだけで 1 つに決まるときだけ対応づける", () => {
    const p: MatchProduct = {
      slug: "x",
      listingMatch: "X",
      variants: [
        { code: "8-256", attrs: { memory_gb: 8, storage_gb: 256 } },
        { code: "16-256", attrs: { memory_gb: 16, storage_gb: 256 } },
        { code: "16-512", attrs: { memory_gb: 16, storage_gb: 512 } },
      ],
    };
    const cfg = (memoryGb: number | null, storageGb: number | null) => matchListing([p], { title: "X", maker: null, model: null, memoryGb, storageGb }).configId;
    assert.equal(cfg(8, null), "8-256");
    assert.equal(cfg(16, null), null);
    assert.equal(cfg(16, 512), "16-512");
    assert.equal(cfg(32, 512), null);
  });

  test("2 つ以上の機種に当てはまる掲載は対応づけない。壊れた正規表現は検出する", () => {
    const ps: MatchProduct[] = [
      { slug: "a", listingMatch: "ThinkPad", variants: [] },
      { slug: "b", listingMatch: "ThinkPad E14", variants: [] },
    ];
    const r = matchListing(ps, { title: "ThinkPad E14 Gen6", maker: null, model: null, memoryGb: null, storageGb: null });
    assert.equal(r.deviceSlug, null);
    assert.deepEqual(r.ambiguous, ["a", "b"]);
    assert.equal(checkPattern("ThinkPad (E14"), "Invalid regular expression: /ThinkPad (E14/i: Unterminated group");
    assert.equal(checkPattern("ThinkPad ?E14"), null);
  });

  test("HTML をテキスト行にし、全角・特殊文字を正規化する", () => {
    assert.deepEqual(htmlToLines("<div>最⼤4.2GHz</div><script>x</script><p>Ａ&amp;Ｂ</p>"), ["最大4.2GHz", "A&B"]);
  });
});

describe("各社ページの解析（構造だけを再現した最小 HTML）", () => {
  test("e-TAMAYA：月額表と税抜表記", () => {
    const html = `<div>商品コード：PCM080</div><div>マンスリーモデルレンタル</div><h2>HP ProBook 460 G11【マンスリーレンタル】</h2>
      <p>レンタル料金（税抜）</p><dl><dt>1ヶ月</dt><dd>12,000 円/月</dd><dt>3ヶ月</dt><dd>11,000 円/月</dd></dl>
      <h3>主な仕様</h3><dl><dt>OS</dt><dd>Windows 11 Pro(64bit)</dd><dt>CPU</dt><dd>Ultra 5</dd><dt>クロック数</dt><dd>最大4.3GHz</dd>
      <dt>メモリ</dt><dd>16GB</dd><dt>ストレージ</dt><dd>512GB SSD</dd></dl>`;
    const l = parseTamaya(html, "https://www.e-tamaya.co.jp/x.php")!;
    assert.equal(l.externalId, "PCM080");
    assert.equal(l.title, "HP ProBook 460 G11");
    assert.equal(l.maker, "HP");
    assert.equal(l.cpu, "Core Ultra 5 最大4.3GHz");
    assert.equal(l.priceTax, "excl");
    assert.deepEqual(
      l.prices.map((p) => [p.termValue, p.priceYen, p.basis]),
      [
        [1, 12000, "per_month"],
        [3, 11000, "per_month"],
      ],
    );
  });

  test("法パソ：期間別の月額単価と仕様表", () => {
    const html = `<h1>DELL Vostro 3420 Core i5・16GBメモリ搭載 SSD512GB</h1><p>商品番号：592</p>
      <dl><dt>期間</dt><dt>価格</dt><dt>~1ヶ月</dt><dd>13,000円</dd><dt>~2年</dt><dd>4,600円</dd></dl>
      <h3>主な仕様</h3><dl><dt>メーカー</dt><dd>DELL</dd><dt>シリーズ</dt><dd>Vostro</dd><dt>型番</dt><dd>3420</dd>
      <dt>ストレージ</dt><dd>512(SSD)</dd><dt>メモリ</dt><dd>16GB</dd><dt>CPU</dt><dd>Core i5</dd></dl>`;
    const l = parseBusters(html, "https://pc.rentalbusters.net/item/592/")!;
    assert.equal(l.model, "Vostro 3420");
    assert.equal(l.storageGb, 512);
    assert.equal(l.priceTax, "unknown");
    assert.deepEqual(
      l.prices.map((p) => [p.termValue, p.priceYen]),
      [
        [1, 13000],
        [24, 4600],
      ],
    );
  });

  test("Rentio：法人向けノートPCカテゴリ以外のページは除外する", () => {
    const ld = (name: string) => `<script type="application/ld+json">{"@type":"Product","name":"${name}","offers":{"price":15000}}</script>`;
    const body = `<p>15,000 円 月額 (税込)</p><p>ご選択中のプランでは、 9ヶ月以上のご利用で返却時の解約料が0円となります。</p>
      <p>「点検済みリユース品」の場合</p><p>「新品」の場合</p>`;
    const page = ld("【法人向け】Apple MacBook Pro 14インチ (M5, 2025) / 512GB SSD /16GB") + body + `<a href="/t/genre/pc/notepc/business-pc">他の法人向け</a>`;
    const l = parseRentio(page, "https://www.rentio.jp/products/abc")!;
    assert.deepEqual([l.memoryGb, l.storageGb], [16, 512]);
    assert.equal(l.deviceSlug, null, "機種との対応づけは取り込み時に DB で行う");
    assert.equal(l.condition, "selectable");
    assert.deepEqual(l.prices, [{ termUnit: "month", termValue: 9, priceYen: 15000, basis: "per_month", label: "月額制（9か月以上）" }]);
    assert.equal(parseRentio(ld("空気清浄機") + body, "https://www.rentio.jp/products/air"), null);
  });
});

test("取り込み用データ（supabase/data/rental-listings.json）の整合性", () => {
  const data: RentalDataFile = JSON.parse(readFileSync("supabase/data/rental-listings.json", "utf8"));
  const companyIds = new Set(data.companies.map((c) => c.id));
  const keys = new Set<string>();
  for (const l of data.listings) {
    assert.ok(companyIds.has(l.companyId), `未登録の会社 ${l.companyId}`);
    const k = `${l.companyId}:${l.externalId}`;
    assert.ok(!keys.has(k), `重複 ${k}`);
    keys.add(k);
    assert.ok(l.prices.length > 0, `価格なし ${k}`);
    assert.ok(l.prices.every((p) => Number.isInteger(p.priceYen) && p.priceYen > 0), `価格が不正 ${k}`);
    assert.match(l.url, /^https:\/\//);
  }
});

test("仕様表の値が空欄なら次の項目名を値にしない", async () => {
  const { valueAfter } = await import("../scripts/rentals/lib");
  assert.equal(valueAfter(["OS", "ディスプレイ", "14インチ"], "OS"), null);
  assert.equal(valueAfter(["OS", "Windows 11 Pro", "CPU"], "OS"), "Windows 11 Pro");
});
