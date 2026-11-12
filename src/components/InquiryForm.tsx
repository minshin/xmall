"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitInquiryAction, type FormState } from "@/app/actions";
import { track } from "@/lib/analytics";
import { CONSULT_MONTHS, PREFECTURES } from "@/lib/validation";

type Consult = { deviceSlug: string; configId: string; months: string; quantity: string };

const field = "w-full border border-[#D6D6D0] rounded-lg px-3 py-2.5 text-sm bg-white";
const Err = ({ msg }: { msg?: string }) => (msg ? <span className="text-xs text-[#B42318]">{msg}</span> : null);
const Req = () => <span className="text-[11px] text-white bg-[#B42318] rounded px-1.5 py-0.5 ml-1.5 align-middle">必須</span>;

/** 今月から12か月分の「利用開始月」 */
function months(): { value: string; label: string }[] {
  const d = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    return { value: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, label: `${m.getFullYear()}年${m.getMonth() + 1}月` };
  });
}

/** prefill：ログイン中の会員の会社情報（未ログインなら空） */
export function InquiryForm({ consult, prefill = {} }: { consult: Consult; prefill?: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitInquiryAction, { ok: false, errors: {} });
  const v = state.values ?? { ...prefill, quantity: consult.quantity, months: consult.months };
  const e = state.errors;

  return (
    <form action={action} onSubmit={() => track("inquiry_submit", { device: consult.deviceSlug })} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="deviceSlug" value={consult.deviceSlug} />
      <input type="hidden" name="configId" value={consult.configId} />
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">
            台数
            <Req />
          </span>
          <input name="quantity" type="number" min={1} max={1000} inputMode="numeric" defaultValue={v.quantity} className={field} />
          <Err msg={e.quantity} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">利用期間</span>
          <select name="months" defaultValue={v.months ?? ""} className={field}>
            <option value="">未定</option>
            {CONSULT_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}か月
              </option>
            ))}
          </select>
          <Err msg={e.months} />
        </label>
      </div>
      <div aria-hidden="true" className="hidden">
        <label>
          Webサイト
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">
          会社名
          <Req />
        </span>
        <input name="company" defaultValue={v.company} autoComplete="organization" maxLength={100} className={field} />
        <Err msg={e.company} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">
          ご担当者名
          <Req />
        </span>
        <input name="contactName" defaultValue={v.contactName} autoComplete="name" maxLength={50} className={field} />
        <Err msg={e.contactName} />
      </label>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">
            メールアドレス
            <Req />
          </span>
          <input name="email" type="email" defaultValue={v.email} autoComplete="email" maxLength={254} className={field} />
          <Err msg={e.email} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">電話番号</span>
          <input name="phone" type="tel" defaultValue={v.phone} autoComplete="tel" maxLength={30} placeholder="03-1234-5678" className={field} />
          <Err msg={e.phone} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">お届け先の都道府県</span>
          <select name="prefecture" defaultValue={v.prefecture ?? ""} className={field}>
            <option value="">選んでください</option>
            {PREFECTURES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <Err msg={e.prefecture} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">利用開始の希望</span>
          <select name="startMonth" defaultValue={v.startMonth ?? ""} className={field}>
            <option value="">未定</option>
            {months().map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <Err msg={e.startMonth} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">ご要望・ご質問</span>
        <textarea
          name="message"
          defaultValue={v.message}
          rows={4}
          maxLength={2000}
          placeholder="例：入れてほしいソフト、請求書払いの可否、設立間もないが審査は通るか など"
          className={field}
        />
        <Err msg={e.message} />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" defaultChecked={v.agree === "on"} className="mt-1" />
        <span>
          入力した内容を xmall がご相談への回答のために利用することに同意します。レンタル会社へ情報をお渡しする場合は、事前にご確認します（<Link href="/privacy">個人情報の取り扱い</Link>）。
        </span>
      </label>
      <Err msg={e.agree} />
      <Err msg={e._} />

      <button type="submit" disabled={pending} className="min-h-12 px-5 py-3 rounded-[10px] text-base font-bold cursor-pointer bg-brand text-white disabled:opacity-60">
        {pending ? "送信中…" : "この内容で相談する（無料）"}
      </button>
      <p className="m-0 text-xs text-mute">相談しても契約にはなりません。契約・審査・配送は各レンタル会社が行います。</p>
    </form>
  );
}
