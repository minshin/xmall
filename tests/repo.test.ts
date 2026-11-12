import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import postgres from "postgres";
import * as repo from "../src/lib/repo";
import { contactSchema, quoteSchema, reviewSchema } from "../src/lib/validation";

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
    const q = quoteSchema.parse({ deviceSlug: slug, configId: "16-512", grade: "A", term: "24", template: "OFFICE", quantity: "3", supplierId: "bayside" });
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
    const id = await repo.insertInquiry(sql, q, { monthlyPerUnit: 8920, contractTotal: 642240 }, c, A);
    const [row] = await repo.listInquiries(sql, "new");
    assert.equal(row.id, id);
    assert.equal(row.quantity, 3);
    assert.equal(row.term, 24);
    assert.equal(await repo.updateInquiry(sql, id, "forwarded", "ベイサイドに電話済み"), true);
    assert.equal((await repo.listInquiries(sql, "new")).length, 0);
    assert.equal((await repo.listInquiries(sql))[0].adminNote, "ベイサイドに電話済み");
    const counts = await repo.adminCounts(sql);
    assert.equal(counts.inquiries_30d, 1);
    assert.equal(counts.new_inquiries, 0);
  });
});
