"use client";

import { useState } from "react";
import { USE_LABEL } from "@/lib/catalog";
import type { Review, Use } from "@/lib/types";

// TODO: いいね・参考になった の永続化（Supabase）。現状は表示上のみ。

export function LikeButton({ base }: { base: number }) {
  const [liked, setLiked] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={liked}
      onClick={() => setLiked((v) => !v)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] cursor-pointer min-h-9 ${
        liked ? "border border-[#C2410C] bg-[#FFF1E8] text-buy" : "border border-[#D6D6D0] bg-white"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={liked ? "#C2410C" : "none"} stroke="#C2410C" strokeWidth="1.8" />
      </svg>
      {liked ? "気になる済み" : "気になる"} {(base + (liked ? 1 : 0)).toLocaleString("ja-JP")}
    </button>
  );
}

export function ReviewList({ reviews }: { reviews: Review[] }) {
  const [filter, setFilter] = useState<Use | "all">("all");
  const [helped, setHelped] = useState<Record<string, boolean>>({});
  const uses = [...new Set(reviews.map((r) => r.use))];
  const list = reviews.filter((r) => filter === "all" || r.use === filter);
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs cursor-pointer min-h-8 ${on ? "bg-ink text-white border border-ink" : "bg-white border border-[#D6D6D0]"}`;

  if (!reviews.length) return <p className="m-0 text-sm text-sub">まだ口コミはありません。</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={pill(filter === "all")} onClick={() => setFilter("all")}>
          すべて
        </button>
        {uses.map((u) => (
          <button key={u} type="button" className={pill(filter === u)} onClick={() => setFilter(u)}>
            {USE_LABEL[u]}
          </button>
        ))}
      </div>
      {list.map((r) => {
        const on = !!helped[r.id];
        return (
          <article key={r.id} className="border border-[#EEEEEA] rounded-xl px-4 py-3.5 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 items-baseline text-xs text-mute">
              <b className="text-ink text-sm" aria-label={`評価 ${r.rating}`}>
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </b>
              <span>{r.author}</span>
              <span>・{USE_LABEL[r.use]}</span>
              <span>・{r.via}</span>
              <span className="bg-ok-soft text-ok px-2 py-0.5 rounded-full">{r.acquisition === "rent" ? "レンタル利用者" : "購入者"}</span>
            </div>
            <p className="m-0 text-sm leading-relaxed">{r.body}</p>
            <div className="flex gap-2 items-center text-xs">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setHelped((h) => ({ ...h, [r.id]: !on }))}
                className={`rounded-full px-3 py-1.5 cursor-pointer min-h-8 ${on ? "border border-brand bg-brand-soft text-[#1F3F9C]" : "border border-[#D6D6D0] bg-white"}`}
              >
                参考になった {r.helpful + (on ? 1 : 0)}
              </button>
              <span className="text-mute">返信 {r.replies}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
