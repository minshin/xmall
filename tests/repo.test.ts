import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import * as repo from "../src/lib/repo";
import * as accounts from "../src/lib/repo-accounts";
import * as admin from "../src/lib/repo-admin";
import * as cat from "../src/lib/repo-catalog";
import { rematchListings } from "../src/lib/rental-match";
import { contactSchema, consultSchema, reviewSchema } from "../src/lib/validation";

/**
 * DB を使うテスト。TEST_DATABASE_URL（DB名が _test で終わるもの）があるときだけ実行。
 * 例：createdb xmall_test && TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/xmall_test npm test
 * 毎回 public スキーマを作り直して supabase/migrations を流す。
 */
const url = process.env.TEST_DATABASE_URL;
const skip = !url ? "TEST_DATABASE_URL 未設定" : !/_test(\?|$)/.test(url) ? "DB名が _test で終わらないため実行しない" : false;

describe("repo（Postgres）", { skip }, () => {
  const sql = postgres(url ?? "", { max: 2, onnotice: () => {} });
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const slug = "macbook-pro-14-m5";

  before(async () => {
    await sql.unsafe("drop schema if exists public cascade; create schema public;");
    // Supabase の auth / storage スキーマの最小スタブ（素の Postgres でも migration を流せるように）
    await sql.unsafe(`
      drop schema if exists auth cascade; create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', email_confirmed_at timestamptz);
      create schema if not exists storage;
      create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    for (const f of readdirSync("supabase/migrations").sort()) await sql.unsafe(readFileSync(`supabase/migrations/${f}`, "utf8"));
  });
  after(() => sql.end());

  test("いいねは訪問者ごとに1回、もう一度押すと取り消し", async () => {
    assert.deepEqual(await repo.toggleLike(sql, slug, A), { liked: true, likes: 1 });
    assert.deepEqual(await repo.toggleLike(sql, slug, B), { liked: true, likes: 2 });
    assert.deepEqual(await repo.toggleLike(sql, slug, A), { liked: false, likes: 1 });
    assert.equal(await repo.hasLiked(sql, slug, B), true);
    assert.equal(await repo.hasLiked(sql, slug, A), false);
    assert.equal((await repo.deviceStats(sql))[slug].likes, 1);
  });

  test("口コミは審査で掲載されるまで表示されない", async () => {
    const input = reviewSchema.parse({
      deviceSlug: slug,
      rating: "4",
      author: "IT企業・総務",
      use: "office",
      acquisition: "rent",
      via: "",
      body: "設定済みで届いたので初日から使えました。バッテリーも一日もちます。",
    });
    const id = await repo.insertReview(sql, input, A);
    assert.equal((await repo.approvedReviews(sql, slug)).length, 0);
    assert.equal((await repo.reviewsByStatus(sql, "pending")).length, 1);
    assert.equal(await repo.recentCount(sql, "reviews", A), 1);

    assert.equal(await repo.moderateReview(sql, id, "approved"), slug);
    const list = await repo.approvedReviews(sql, slug);
    assert.equal(list.length, 1);
    assert.equal(list[0].via, null);
    const stats = (await repo.deviceStats(sql))[slug];
    assert.equal(stats.reviewCount, 1);
    assert.equal(stats.rating, 4);

    // 参考になった
    assert.deepEqual(await repo.toggleHelpful(sql, id, B), { helped: true, helpful: 1, deviceSlug: slug });
    assert.deepEqual(await repo.helpedReviewIds(sql, slug, B), [id]);
    assert.equal((await repo.approvedReviews(sql, slug))[0].helpful, 1);
    assert.deepEqual(await repo.toggleHelpful(sql, id, B), { helped: false, helpful: 0, deviceSlug: slug });

    // 非掲載にすると消え、参考になったも押せない
    await repo.moderateReview(sql, id, "rejected", "宣伝目的");
    assert.equal((await repo.approvedReviews(sql, slug)).length, 0);
    assert.equal(await repo.toggleHelpful(sql, id, B), null);
  });

  test("DB の制約でも不正値を弾く", async () => {
    await assert.rejects(
      sql`insert into public.reviews (device_slug, rating, author, use_case, acquisition, body) values (${slug}, 6, 'xx', 'office', 'rent', ${"あ".repeat(30)})`,
    );
  });

  test("問い合わせの保存・一覧・ステータス更新", async () => {
    const q = consultSchema.parse({ deviceSlug: slug, configId: "16-512", months: "24", quantity: "3" });
    const c = contactSchema.parse({
      company: "株式会社テスト",
      contactName: "山田 太郎",
      email: "taro@example.co.jp",
      phone: "03-1234-5678",
      prefecture: "東京都",
      startMonth: "2027-01",
      message: "",
      agree: "on",
    });
    assert.equal(c.message, null);
    const id = await repo.insertInquiry(sql, q, c, A);
    const [row] = await repo.listInquiries(sql, "new");
    assert.equal(row.id, id);
    assert.equal(row.quantity, 3);
    assert.equal(row.months, 24);
    assert.equal(row.configId, "16-512");
    assert.equal(await repo.updateInquiry(sql, id, "forwarded", "Rentio を案内済み"), true);
    assert.equal((await repo.listInquiries(sql, "new")).length, 0);
    assert.equal((await repo.listInquiries(sql))[0].adminNote, "Rentio を案内済み");
    const counts = await repo.adminCounts(sql);
    assert.equal(counts.inquiries_30d, 1);
    assert.equal(counts.new_inquiries, 0);
  });

  test("レンタル掲載：upsert で重複せず、消えた商品は掲載終了になる", async () => {
    const company = { id: "acme", name: "ACME", operator: null, url: "https://example.com/", audience: "business" as const, note: null };
    const listing = (externalId: string, priceYen: number) => ({
      companyId: "acme", externalId, url: `https://example.com/${externalId}`, title: `MacBook Pro 14 M5 ${externalId}`,
      maker: "Apple", model: null, cpu: "M5", memoryGb: 16, storageGb: 512, os: "macOS", condition: null, officeIncluded: false,
      inStock: null, priceTax: "incl" as const, terms: null, deviceSlug: slug, configId: "16-512", fetchedAt: "2026-11-12",
      prices: [{ termUnit: "month" as const, termValue: 1, priceYen, basis: "per_month" as const, label: "1ヶ月" }],
    });
    await repo.importRentalData(sql, { companies: [company], listings: [listing("a", 15000), listing("b", 9000)] });
    assert.equal((await repo.rentalListings(sql, { deviceSlug: slug })).length, 0, "取り込みでは対応づけない（JSON の deviceSlug は使わない）");
    // 機種（公開・構成 16-512）を用意して、正規表現で対応づける
    await sql`insert into public.sites (id, name, kind) values ('apple-test', 'Apple', 'maker')`;
    const uid = "33333333-3333-4333-8333-333333333333";
    const pid = await admin.createProduct(sql, { slug, categoryId: "laptop", brandId: "apple-test", name: "MacBook Pro 14インチ" }, uid);
    await admin.saveVariants(sql, pid, [{ code: "16-512", label: "16GB / 512GB", attrs: { memory_gb: 16, storage_gb: 512 }, officialPrice: null, note: null }], uid);
    await sql`update public.products set status = 'published', listing_match = 'MacBook Pro 14 M5' where id = ${pid}`;
    const m = await rematchListings(sql);
    assert.equal(m.matched, 2);
    assert.deepEqual((await repo.rentalListings(sql, { deviceSlug: slug })).map((l) => [l.externalId, l.prices[0].priceYen]), [["b", 9000], ["a", 15000]]);

    const r = await repo.importRentalData(sql, { companies: [company], listings: [listing("a", 14000)] });
    assert.equal(r.deactivated, 1);
    const now = await repo.rentalListings(sql, { deviceSlug: slug });
    assert.deepEqual(now.map((l) => [l.externalId, l.prices[0].priceYen, l.companyName]), [["a", 14000, "ACME"]], "取り込み直しても対応づけは残る");
    // 機種ページ側：掲載が比較用の形で付く（構成もメモリ・ストレージで対応づく）
    const [d] = await cat.loadProducts(sql, { slug });
    assert.deepEqual(d.rentals.map((o) => [o.companyName, o.monthly, o.configId]), [["ACME", 14000, "16-512"]]);
    // 手で「対応なし」にしたものは、やり直しても戻らない
    const [{ id: lid }] = await sql<{ id: string }[]>`select id from public.rental_listings where external_id = 'a'`;
    await admin.setListingMatch(sql, lid, { deviceSlug: null, configId: null, manual: true });
    await rematchListings(sql);
    assert.equal((await repo.rentalListings(sql, { deviceSlug: slug })).length, 0);
  });

  test("閲覧者数は訪問者ごとに1回だけ数え、集計ビューに出る", async () => {
    assert.equal(await repo.recordView(sql, slug, A), 1);
    assert.equal(await repo.recordView(sql, slug, A), 1);
    assert.equal(await repo.recordView(sql, slug, B), 2);
    assert.equal((await repo.deviceStats(sql))[slug].views, 2);
  });

  test("サインアップで profiles ができ、ログイン中の行動は会員に紐づく", async () => {
    const uid = "33333333-3333-4333-8333-333333333333";
    await sql`insert into auth.users (id, email, raw_user_meta_data) values (${uid}, 'buyer@example.co.jp', '{"full_name":"山田"}')`;
    const p = await accounts.getProfile(sql, uid);
    assert.equal(p?.email, "buyer@example.co.jp");
    assert.equal(p?.role, "user");
    assert.equal(p?.fullName, "山田");
    await accounts.updateProfile(sql, uid, { fullName: "山田 太郎", companyName: "株式会社テスト", department: null, phone: null, companySize: "10-49" });
    const C = "44444444-4444-4444-8444-444444444444";
    await repo.recordView(sql, slug, C, uid);
    await repo.recordView(sql, slug, C, uid);
    await repo.toggleLike(sql, slug, C, uid);
    const act = await accounts.userActivity(sql, uid);
    assert.deepEqual(act.views.map((v) => [v.deviceSlug, v.viewCount]), [[slug, 2]]);
    assert.equal(act.likes.length, 1);
    const { users } = await accounts.listUsers(sql, { q: "テスト" });
    assert.equal(users[0].companyName, "株式会社テスト");
    assert.equal(users[0].views, 1);
    assert.equal(await accounts.setRole(sql, uid, "editor"), true);
    assert.equal(accounts.hasRole(await accounts.getProfile(sql, uid), "editor"), true);
  });

  test("カタログ：品目のスペック項目で製品を作り、公開したものだけ読める", async () => {
    await sql`insert into public.sites (id, name, kind) values ('acme-maker', 'ACME', 'maker')`;
    const uid = "33333333-3333-4333-8333-333333333333";
    const id = await admin.createProduct(sql, { slug: "acme-24", categoryId: "monitor", brandId: "acme-maker", name: "ACME 24" }, uid);
    assert.equal((await cat.loadProducts(sql)).some((d) => d.slug === "acme-24"), false, "下書きは公開側に出ない");
    const attrs = (await cat.loadCategories(sql)).find((c) => c.id === "monitor")!.attributes;
    const size = attrs.find((a) => a.key === "size_inch")!;
    const res = attrs.find((a) => a.key === "resolution")!;
    await admin.saveSpecs(sql, id, [
      { attributeId: size.id, value: 23.8, display: null, plain: "机に置いてちょうどいい大きさ" },
      { attributeId: res.id, value: "フルHD", display: null, plain: null },
    ], uid);
    await admin.saveVariants(sql, id, [{ code: "std", label: "標準", attrs: {}, officialPrice: 19800, note: null }], uid);
    await admin.updateProductBase(sql, id, {
      slug: "acme-24", categoryId: "monitor", brandId: "acme-maker", name: "ACME 24", subtitle: "24型", releaseDate: null,
      status: "published", verified: false, bodyColor: "#333333", uses: ["office"], listingMatch: "ACME ?24",
    }, uid);
    const [d] = await cat.loadProducts(sql, { slug: "acme-24" });
    assert.equal(d.categoryName, "モニター");
    assert.equal(d.brand, "ACME");
    assert.deepEqual(d.specs.map((x) => [x.key, x.display]), [["size_inch", "23.8インチ"], ["resolution", "フルHD"]]);
    assert.equal(d.specs[0].highlight, true);
    assert.equal(d.configs[0].officialPrice, 19800);
    assert.equal(d.listingMatch, "ACME ?24");
    await assert.rejects(() => admin.saveVariants(sql, id, [
      { code: "a", label: "A", attrs: {}, officialPrice: null, note: null },
      { code: "a", label: "B", attrs: {}, officialPrice: null, note: null },
    ], uid), "構成コードの重複は DB でも弾く");
    assert.equal(await admin.deleteSite(sql, "acme-maker"), false, "製品が使っているメーカーは消せない");
  });
});
