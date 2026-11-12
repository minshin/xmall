import assert from "node:assert/strict";
import { test } from "node:test";
import { hasRole } from "../src/lib/repo-accounts";
import { consultSchema, contactSchema, firstErrors, reviewSchema } from "../src/lib/validation";
import { productBaseSchema } from "../src/lib/validation-admin";

test("口コミ：本文30文字未満・未知の機種・評価なしはエラー", () => {
  const r = reviewSchema.safeParse({ deviceSlug: "NOPE!", rating: "", author: "a", use: "", acquisition: "", via: "", body: "短い" });
  assert.equal(r.success, false);
  const e = firstErrors(r.error!);
  assert.ok(e.deviceSlug && e.rating && e.author && e.use && e.acquisition && e.body);
});

test("相談の条件：期間は1〜60か月か未定、台数は1〜1000、構成は空なら null", () => {
  const base = { deviceSlug: "macbook-pro-14-m5" };
  assert.equal(consultSchema.safeParse({ ...base, configId: "", months: "61", quantity: "1" }).success, false);
  assert.equal(consultSchema.safeParse({ ...base, configId: "", months: "", quantity: "0" }).success, false);
  const ok = consultSchema.parse({ ...base, configId: "", months: "", quantity: "1000" });
  assert.deepEqual([ok.configId, ok.months, ok.quantity], [null, null, 1000]);
  assert.equal(consultSchema.parse({ ...base, configId: "16-512", months: "18", quantity: "3" }).months, 18);
});

test("機種の slug：一覧ページの URL（brand / price / use）と重なるものは不可、対応づけの正規表現は検査する", () => {
  const base = { name: "X", categoryId: "laptop", brandId: "dell", subtitle: "", releaseDate: "", status: "draft", verified: false, bodyColor: "#000000", uses: [] };
  assert.equal(productBaseSchema.safeParse({ ...base, slug: "brand", listingMatch: "" }).success, false);
  assert.equal(productBaseSchema.safeParse({ ...base, slug: "x-1", listingMatch: "Latitude (5450" }).success, false);
  assert.equal(productBaseSchema.parse({ ...base, slug: "x-1", listingMatch: "" }).listingMatch, null);
});

test("連絡先：同意必須・メール形式・空欄は null", () => {
  const ok = contactSchema.parse({ company: "A社", contactName: "B", email: "b@example.jp", phone: "", prefecture: "", startMonth: "", message: " ", agree: "on" });
  assert.equal(ok.phone, null);
  assert.equal(ok.prefecture, null);
  assert.equal(ok.message, null);
  const ng = contactSchema.safeParse({ company: "", contactName: "", email: "x", phone: "abc", prefecture: "火星", startMonth: "2027/1", message: "", agree: "" });
  const e = firstErrors(ng.error!);
  assert.deepEqual(Object.keys(e).sort(), ["agree", "company", "contactName", "email", "phone", "prefecture", "startMonth"]);
});

test("権限：editor はカタログ・審査、admin はさらに会員管理。未ログインは不可", () => {
  assert.equal(hasRole(null, "user"), false);
  assert.equal(hasRole({ role: "user" }, "editor"), false);
  assert.equal(hasRole({ role: "editor" }, "editor"), true);
  assert.equal(hasRole({ role: "editor" }, "admin"), false);
  assert.equal(hasRole({ role: "admin" }, "editor"), true);
});
