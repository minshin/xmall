"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { submitReviewAction, toggleHelpfulAction, toggleLikeAction, type FormState } from "@/app/actions";
import { USE_LABEL } from "@/lib/labels";
import type { Review, Use } from "@/lib/types";

const Heart = ({ on }: { on: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={on ? "#C2410C" : "none"} stroke="#C2410C" strokeWidth="1.8" />
  </svg>
);

// ───────── いいね ─────────

export function LikeButton({ slug, likes, liked }: { slug: string; likes: number; liked: boolean }) {
  const [state, setState] = useState({ likes, liked });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const onClick = () =>
    start(async () => {
      setOptimistic({ liked: !optimistic.liked, likes: optimistic.likes + (optimistic.liked ? -1 : 1) });
      const r = await toggleLikeAction(slug);
      if (r) setState(r);
      setFailed(!r);
    });

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={optimistic.liked}
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] cursor-pointer min-h-9 ${
          optimistic.liked ? "border border-[#C2410C] bg-[#FFF1E8] text-buy" : "border border-[#D6D6D0] bg-white"
        }`}
      >
        <Heart on={optimistic.liked} />
        {optimistic.liked ? "気になる済み" : "気になる"} {optimistic.likes.toLocaleString("ja-JP")}
      </button>
      {failed && <span className="text-xs text-mute">保存できませんでした</span>}
    </span>
  );
}

/** Suspense の fallback 用（押せない表示だけ） */
export function LikeButtonPlaceholder({ likes }: { likes: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] min-h-9 border border-[#D6D6D0] bg-white">
      <Heart on={false} />
      気になる {likes.toLocaleString("ja-JP")}
    </span>
  );
}

// ───────── 口コミ一覧 ─────────

function HelpfulButton({ review, helped }: { review: Review; helped: boolean }) {
  const [state, setState] = useState({ helped, helpful: review.helpful });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic.helped}
      onClick={() =>
        start(async () => {
          setOptimistic({ helped: !optimistic.helped, helpful: optimistic.helpful + (optimistic.helped ? -1 : 1) });
          const r = await toggleHelpfulAction(review.id);
          if (r) setState(r);
        })
      }
      className={`rounded-full px-3 py-1.5 cursor-pointer min-h-8 ${
        optimistic.helped ? "border border-brand bg-brand-soft text-[#1F3F9C]" : "border border-[#D6D6D0] bg-white"
      }`}
    >
      参考になった {optimistic.helpful}
    </button>
  );
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
};

export function ReviewList({ reviews, helped }: { reviews: Review[]; helped: string[] }) {
  const [filter, setFilter] = useState<Use | "all">("all");
  const uses = [...new Set(reviews.map((r) => r.use))];
  const list = reviews.filter((r) => filter === "all" || r.use === filter);
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs cursor-pointer min-h-8 ${on ? "bg-ink text-white border border-ink" : "bg-white border border-[#D6D6D0]"}`;

  if (!reviews.length) return <p className="m-0 text-sm text-sub">まだ口コミはありません。最初の口コミを書いてみませんか？</p>;

  return (
    <div className="flex flex-col gap-3">
      {uses.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="用途で絞り込む">
          <button type="button" className={pill(filter === "all")} onClick={() => setFilter("all")}>
            すべて
          </button>
          {uses.map((u) => (
            <button key={u} type="button" className={pill(filter === u)} onClick={() => setFilter(u)}>
              {USE_LABEL[u]}
            </button>
          ))}
        </div>
      )}
      {list.map((r) => (
        <article key={r.id} className="border border-[#EEEEEA] rounded-xl px-4 py-3.5 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-baseline text-xs text-mute">
            <b className="text-ink text-sm" aria-label={`評価 ${r.rating}`}>
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </b>
            <span>{r.author}</span>
            <span>・{USE_LABEL[r.use]}</span>
            {r.via && <span>・{r.via}</span>}
            <span>・{fmtDate(r.createdAt)}</span>
            <span className="bg-ok-soft text-ok px-2 py-0.5 rounded-full">{r.acquisition === "rent" ? "レンタル利用" : "購入"}</span>
            {r.sample && <span className="bg-[#FFF1DD] text-[#8A4B00] px-2 py-0.5 rounded-full">サンプル</span>}
          </div>
          <p className="m-0 text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
          <div className="flex gap-2 items-center text-xs">
            <HelpfulButton review={r} helped={helped.includes(r.id)} />
          </div>
        </article>
      ))}
    </div>
  );
}

// ───────── 口コミ投稿 ─────────

const field = "w-full border border-[#D6D6D0] rounded-lg px-3 py-2.5 text-sm bg-white";
const Err = ({ msg }: { msg?: string }) => (msg ? <span className="text-xs text-[#B42318]">{msg}</span> : null);

export function ReviewForm({ slug, deviceName }: { slug: string; deviceName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(submitReviewAction, { ok: false, errors: {} });
  const v = state.values ?? {};
  const e = state.errors;

  if (state.ok)
    return (
      <p className="m-0 text-sm bg-ok-soft text-ok rounded-lg px-4 py-3">
        口コミを受け付けました。内容を確認したうえで、数日以内に掲載します。ありがとうございました。
      </p>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start min-h-10 px-4 py-2 rounded-lg text-sm cursor-pointer border border-brand text-brand bg-white">
        口コミを書く
      </button>
    );

  return (
    <form action={action} className="flex flex-col gap-3.5 border border-line rounded-xl p-4" noValidate>
      <p className="m-0 font-bold">{deviceName}の口コミを書く</p>
      <input type="hidden" name="deviceSlug" value={slug} />
      <div aria-hidden="true" className="hidden">
        <label>
          Webサイト
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="border-0 p-0 m-0">
        <legend className="text-sm font-bold mb-1.5">総合評価</legend>
        <div className="flex gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="flex items-center gap-1 border border-[#D6D6D0] rounded-lg px-3 py-2 text-sm cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="rating" value={n} defaultChecked={v.rating === String(n)} className="sr-only" />
              {"★".repeat(n)}
            </label>
          ))}
        </div>
        <Err msg={e.rating} />
      </fieldset>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">肩書き</span>
          <input name="author" defaultValue={v.author} placeholder="例：IT企業・総務" maxLength={40} className={field} />
          <span className="text-xs text-mute">会社名や個人名は書かないでください</span>
          <Err msg={e.author} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">主な用途</span>
          <select name="use" defaultValue={v.use ?? ""} className={field}>
            <option value="" disabled>
              選んでください
            </option>
            {Object.entries(USE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <Err msg={e.use} />
        </label>
        <fieldset className="flex flex-col gap-1 text-sm border-0 p-0 m-0">
          <legend className="font-bold mb-1">入手方法</legend>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="acquisition" value="rent" defaultChecked={v.acquisition === "rent"} /> レンタル
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="acquisition" value="buy" defaultChecked={v.acquisition === "buy"} /> 購入
            </label>
          </div>
          <Err msg={e.acquisition} />
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">
            利用したサービス <span className="font-normal text-mute">（任意）</span>
          </span>
          <input name="via" defaultValue={v.via} placeholder="例：〇〇レンタル・24か月" maxLength={60} className={field} />
          <Err msg={e.via} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold">使ってみた感想（30文字以上）</span>
        <textarea name="body" defaultValue={v.body} rows={5} maxLength={2000} placeholder="良かった点・気になった点、どんな作業に使っているかなど" className={field} />
        <Err msg={e.body} />
      </label>

      <Err msg={e._} />
      <p className="m-0 text-xs text-mute">投稿は運営が内容を確認してから掲載します。広告目的の投稿や、個人・会社を特定できる情報は掲載しません。</p>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-10 px-5 py-2 rounded-lg text-sm cursor-pointer bg-brand text-white disabled:opacity-60">
          {pending ? "送信中…" : "投稿する"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 px-4 py-2 rounded-lg text-sm cursor-pointer border border-[#D6D6D0] bg-white">
          閉じる
        </button>
      </div>
    </form>
  );
}
