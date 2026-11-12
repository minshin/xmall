import { getReviews, getStats, viewerState } from "@/lib/community";
import { LikeButton, ReviewList } from "./Social";

/** 機種ページのいいね（Cookie を読むので Suspense の中で使う） */
export async function DeviceLike({ slug }: { slug: string }) {
  const [stats, viewer] = await Promise.all([getStats(slug), viewerState(slug)]);
  return <LikeButton slug={slug} likes={stats.likes} liked={viewer.liked} />;
}

/** 評価の要約（キャッシュのみ。静的シェルに含まれる） */
export async function RatingSummary({ slug }: { slug: string }) {
  const s = await getStats(slug);
  if (!s.reviewCount)
    return (
      <a href="#reviews" className="no-underline text-sub">
        口コミを書く
      </a>
    );
  return (
    <a href="#reviews" className="no-underline">
      ★ {s.rating}（口コミ {s.reviewCount}件）
    </a>
  );
}

/** 口コミ一覧（参考になった の状態に Cookie を使う） */
export async function DeviceReviews({ slug }: { slug: string }) {
  const [reviews, viewer] = await Promise.all([getReviews(slug), viewerState(slug)]);
  return <ReviewList reviews={reviews} helped={viewer.helped} />;
}
