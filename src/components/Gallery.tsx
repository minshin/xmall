"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { Device } from "@/lib/types";
import { DeviceIllustration } from "./DeviceIllustration";

/** 商品画像ギャラリー：大きい画像＋サムネイル。スマホは横スワイプ */
export function Gallery({ device }: { device: Pick<Device, "slug" | "name" | "bodyColor" | "images"> }) {
  const images = device.images ?? [];
  const [i, setI] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  if (!images.length)
    return (
      <div className="aspect-[16/10] rounded-[18px] bg-white flex items-center justify-center">
        <DeviceIllustration color={device.bodyColor} id={`hero-${device.slug}`} width={320} />
      </div>
    );

  const go = (n: number) => {
    const next = (n + images.length) % images.length;
    setI(next);
    const el = strip.current?.children[next] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative group">
        {/* 横スクロール（スマホはスワイプ、PC は矢印・サムネイル） */}
        <div
          ref={strip}
          className="snap-x-strip flex overflow-x-auto rounded-[18px] bg-white"
          onScroll={(e) => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / el.clientWidth);
            if (n !== i) setI(n);
          }}
        >
          {images.map((img, k) => (
            <div key={img.src} className="w-full shrink-0 aspect-[16/10] relative">
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 900px) 100vw, 640px"
                priority={k === 0}
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="前の画像"
              onClick={() => go(i - 1)}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 backdrop-blur items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="次の画像"
              onClick={() => go(i + 1)}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 backdrop-blur items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 sm:hidden">
              {images.map((img, k) => (
                <span key={img.src} className={`h-1.5 rounded-full shadow transition-all ${k === i ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="hidden sm:flex gap-2">
          {images.map((img, k) => (
            <button
              key={img.src}
              type="button"
              aria-label={`画像 ${k + 1}`}
              aria-pressed={k === i}
              onClick={() => go(k)}
              className={`relative w-20 aspect-[16/10] rounded-[10px] overflow-hidden cursor-pointer transition-all ${
                k === i ? "ring-2 ring-brand ring-offset-2" : "opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="m-0 text-[11px] text-faint">画像：{images[i]?.credit}</p>
    </div>
  );
}
