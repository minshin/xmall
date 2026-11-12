"use client";

import { Eye, Heart, PenLine, ThumbsUp } from "lucide-react";
import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { recordViewAction, submitReviewAction, toggleHelpfulAction, toggleLikeAction, type FormState } from "@/app/actions";
import { USE_LABEL } from "@/lib/labels";
import type { Review, Use } from "@/lib/types";
import { Stars } from "./ui";

const n = (x: number) => x.toLocaleString("ja-JP");

// ───────── 閲覧者数（表示時に 1 回記録） ─────────

export function ViewCount({ slug, views }: { slug: string; views: number }) {
  const [count, setCount] = useState(views);
  useEffect(() => {
    let alive = true;
    recordViewAction(slug).then((v) => {
      if (alive && v != null) setCount(v);
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  return (
    <span className="inline-flex items-center gap-1.5 text-mute" title="この機種を見た人">
      <Eye size={16} strokeWidth={1.8} aria-hidden="true" />
      <span key={count} className="tabular-nums animate-fade">
        {n(count)}
      </span>
      <span className="sr-only">人が閲覧</span>
    </span>
  );
}

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
    <button
      type="button"
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? "お気に入りを外す" : "お気に入りに追加"}
      title={failed ? "保存できませんでした" : "お気に入り"}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors ${optimistic.liked ? "text-heart" : "text-mute hover:text-heart"}`}
    >
      <Heart
        key={String(optimistic.liked)}
        size={17}
        strokeWidth={1.8}
        fill={optimistic.liked ? "currentColor" : "none"}
        className={optimistic.liked ? "animate-pop" : ""}
        aria-hidden="true"
      />
      <span className="tabular-nums">{n(optimistic.likes)}</span>
    </button>
  );
}

/** Suspense の fallback 用（押せない表示だけ） */
export function LikeButtonPlaceholder({ likes }: { likes: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-mute">
      <Heart size={17} strokeWidth={1.8} aria-hidden="true" />
      <span className="tabular-nums">{n(likes)}</span>
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
      aria-label="参考になった"
      onClick={() =>
        start(async () => {
          setOptimistic({ helped: !optimistic.helped, helpful: optimistic.helpful + (optimistic.helped ? -1 : 1) });
          const r = await toggleHelpfulAction(review.id);
          if (r) setState(r);
        })
      }
      className={`inline-flex items-center gap-1.5 cursor-pointer text-xs transition-colors ${optimistic.helped ? "text-brand" : "text-mute hover:text-brand"}`}
    >
      <ThumbsUp
        key={String(optimistic.helped)}
        size={14}
        fill={optimistic.helped ? "currentColor" : "none"}
        className={optimistic.helped ? "animate-pop" : ""}
        aria-hidden="true"
      />
      参考になった {optimistic.helpful > 0 ? optimistic.helpful : ""}
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
    `rounded-full px-3.5 py-1.5 text-xs cursor-pointer transition-colors ${on ? "bg-ink text-white" : "bg-ground text-sub hover:bg-hair"}`;

  if (!reviews.length) return <p className="m-0 text-sm text-mute">まだ口コミはありません。</p>;

  return (
    <div className="flex flex-col gap-4">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {list.map((r, k) => (
          <article key={r.id} className="bg-ground rounded-[14px] p-4 flex flex-col gap-2.5 animate-rise" style={{ animationDelay: `${k * 40}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <Stars value={r.rating} />
              <span className="flex gap-1">
                <span className="text-[11px] bg-white text-sub px-2 py-0.5 rounded-full">{r.acquisition === "rent" ? "レンタル" : "購入"}</span>
                {r.sample && <span className="text-[11px] bg-warn-soft text-warn px-2 py-0.5 rounded-full">サンプル</span>}
              </span>
            </div>
            <p className="m-0 text-sm leading-relaxed whitespace-pre-line line-clamp-5">{r.body}</p>
            <div className="mt-auto flex items-center justify-between gap-2 text-xs text-faint">
              <span className="truncate">
                {r.author}・{USE_LABEL[r.use]}・{fmtDate(r.createdAt)}
              </span>
              <HelpfulButton review={r} helped={helped.includes(r.id)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ───────── 口コミ投稿 ─────────

const field = "w-full border border-line rounded-[12px] px-3.5 py-3 text-sm bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";
const Err = ({ msg }: { msg?: string }) => (msg ? <span className="text-xs text-[#B42318]">{msg}</span> : null);

export function ReviewForm({ slug, deviceName }: { slug: string; deviceName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(submitReviewAction, { ok: false, errors: {} });
  const v = state.values ?? {};
  const e = state.errors;

  if (state.ok)
    return (
      <p className="m-0 text-sm bg-ok-soft text-ok rounded-[12px] px-4 py-3 animate-rise">口コミを受け付けました。確認後に掲載します。</p>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary self-start text-sm">
        <PenLine size={15} aria-hidden="true" />
        口コミを書く
      </button>
    );

  return (
    <form action={action} className="flex flex-col gap-4 bg-ground rounded-[18px] p-5 animate-rise" noValidate>
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
            <label key={n} className="flex items-center gap-1 bg-white border border-line rounded-full px-3 py-1.5 text-sm cursor-pointer text-[#ff9f0a] transition has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand">
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
      <p className="m-0 text-xs text-mute">運営が確認してから掲載します。</p>
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary text-sm disabled:opacity-60">
          {pending ? "送信中…" : "投稿する"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn text-sm text-mute">
          閉じる
        </button>
      </div>
    </form>
  );
}
