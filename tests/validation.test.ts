import assert from "node:assert/strict";
import { test } from "node:test";
import { hasRole } from "../src/lib/repo-accounts";
import { contactSchema, firstErrors, quoteSchema, reviewSchema } from "../src/lib/validation";

test("口コミ：本文30文字未満・未知の機種・評価なしはエラー", () => {
  const r = reviewSchema.safeParse({ deviceSlug: "NOPE!", rating: "", author: "a", use: "", acquisition: "", via: "", body: "短い" });
  assert.equal(r.success, false);
  const e = firstErrors(r.error!);
  assert.ok(e.deviceSlug && e.rating && e.author && e.use && e.acquisition && e.body);
});

test("見積条件：期間は12/24/36のみ、台数は1〜1000", () => {
  const base = { deviceSlug: "macbook-pro-14-m5", configId: "16-512", grade: "A", template: "OFFICE", supplierId: "bayside" };
  assert.equal(quoteSchema.safeParse({ ...base, term: "18", quantity: "1" }).success, false);
  assert.equal(quoteSchema.safeParse({ ...base, term: "24", quantity: "0" }).success, false);
  assert.equal(quoteSchema.safeParse({ ...base, term: "36", quantity: "1000" }).success, true);
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
