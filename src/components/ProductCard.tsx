import Link from "next/link";
import { Eye, Heart, Star, Store } from "lucide-react";
import type { DeviceSummary } from "@/lib/catalog";
import { yen } from "@/lib/format";
import type { DeviceStats } from "@/lib/types";
import { Icon } from "./icons";
import { DeviceThumb } from "./ui";

/** 一覧の商品カード（トップ・品目・メーカー・価格帯のページで共通） */
export function ProductCard({ d, stats, index = 0, headingLevel = 2 }: { d: DeviceSummary; stats?: DeviceStats; index?: number; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link href={d.url} className="card lift overflow-hidden flex flex-col text-ink animate-rise" style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}>
      <div className="aspect-[16/10] bg-white overflow-hidden">
        <DeviceThumb device={d} priority={index < 3} />
      </div>
      <div className="p-5 pt-4 flex flex-col gap-3 flex-1">
        <div>
          <p className="m-0 text-xs text-mute">{d.brand}</p>
          <H className="m-0 mt-0.5 text-[21px] font-semibold leading-snug">{d.name}</H>
        </div>
        <ul className="m-0 p-0 list-none flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-sub">
          {d.subtitle && (
            <li className="inline-flex items-center gap-1">
              <Icon name="cpu" size={14} className="text-faint" />
              {d.subtitle}
            </li>
          )}
          {d.highlights.slice(0, 3).map((h) => (
            <li key={h.key} className="inline-flex items-center gap-1">
              <Icon name={h.icon} size={14} className="text-faint" />
              {h.text}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="m-0">
            <span className="text-xs text-mute">月額</span> <b className="text-[24px] font-semibold tabular-nums">{d.rentFrom ? yen(d.rentFrom) : "—"}</b>
            <span className="text-xs text-mute">〜</span>
          </p>
          <span className="flex items-center gap-2.5 text-xs text-faint tabular-nums">
            {d.companyCount > 0 && (
              <span className="inline-flex items-center gap-1" title={`${d.companyCount}社が掲載`}>
                <Store size={13} aria-hidden="true" />
                {d.companyCount}社
              </span>
            )}
            {stats && stats.views > 0 && (
              <span className="inline-flex items-center gap-1">
                <Eye size={13} aria-hidden="true" />
                {stats.views}
              </span>
            )}
            {stats && stats.likes > 0 && (
              <span className="inline-flex items-center gap-1 text-heart">
                <Heart size={13} fill="currentColor" aria-hidden="true" />
                {stats.likes}
              </span>
            )}
            {stats?.rating != null && (
              <span className="inline-flex items-center gap-1 text-[#ff9f0a]">
                <Star size={13} fill="currentColor" aria-hidden="true" />
                {stats.rating}
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
