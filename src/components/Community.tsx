import { Star } from "lucide-react";
import { getReviews, getStats, viewerState } from "@/lib/community";
import { LikeButton, ReviewList, type LikeVariant } from "./Social";

/** 機種ページのお気に入り（Cookie を読むので Suspense の中で使う） */
export async function DeviceLike({ slug, variant }: { slug: string; variant?: LikeVariant }) {
  const [stats, viewer] = await Promise.all([getStats(slug), viewerState(slug)]);
  return <LikeButton slug={slug} likes={stats.likes} liked={viewer.liked} variant={variant} />;
}

/** 評価の要約（キャッシュのみ。静的シェルに含まれる） */
export async function RatingSummary({ slug, large }: { slug: string; large?: boolean }) {
  const s = await getStats(slug);
  if (large)
    return s.reviewCount ? (
      <p className="m-0 flex items-center gap-2">
        <Star size={22} fill="#ff9f0a" className="text-[#ff9f0a]" aria-hidden="true" />
        <b className="text-[28px] font-semibold tabular-nums">{s.rating}</b>
        <span className="text-sm text-mute">{s.reviewCount}件</span>
      </p>
    ) : null;
  return (
    <a href="#reviews" className="inline-flex items-center gap-1.5 text-mute hover:no-underline hover:text-ink">
      <Star size={16} strokeWidth={1.8} fill={s.reviewCount ? "#ff9f0a" : "none"} className={s.reviewCount ? "text-[#ff9f0a]" : ""} aria-hidden="true" />
      {s.reviewCount ? (
        <span className="tabular-nums">
          <span className="text-ink">{s.rating}</span>（{s.reviewCount}）
        </span>
      ) : (
        "口コミを書く"
      )}
    </a>
  );
}

/** 口コミ一覧（参考になった の状態に Cookie を使う） */
export async function DeviceReviews({ slug }: { slug: string }) {
  const [reviews, viewer] = await Promise.all([getReviews(slug), viewerState(slug)]);
  return <ReviewList reviews={reviews} helped={viewer.helped} />;
}
