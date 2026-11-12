"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { Device } from "@/lib/types";
import { DeviceIllustration } from "./DeviceIllustration";

/**
 * 商品画像ギャラリー。画像は切り抜かずに全体を見せ（object-contain）、
 * 背景色は画像の四隅の色に合わせる（黒背景の写真なら黒いステージ、白背景なら白）。
 */
export function Gallery({ device }: { device: Pick<Device, "slug" | "name" | "bodyColor" | "images"> }) {
  const images = device.images ?? [];
  const [i, setI] = useState(0);
  const [bg, setBg] = useState<Record<number, string>>({});
  const strip = useRef<HTMLDivElement>(null);

  if (!images.length)
    return (
      <div className="aspect-[16/9] rounded-[28px] bg-white flex items-center justify-center">
        <DeviceIllustration color={device.bodyColor} id={`hero-${device.slug}`} width={360} />
      </div>
    );

  const go = (n: number) => {
    const next = (n + images.length) % images.length;
    setI(next);
    const el = strip.current?.children[next] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  /** 四隅のピクセルの平均色（同一オリジンの /_next/image なので canvas で読める） */
  const sampleEdge = (k: number, img: HTMLImageElement) => {
    try {
      const c = document.createElement("canvas");
      c.width = 24;
      c.height = 24;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 24, 24);
      const px = [ctx.getImageData(0, 0, 2, 2), ctx.getImageData(22, 0, 2, 2), ctx.getImageData(0, 22, 2, 2), ctx.getImageData(22, 22, 2, 2)].flatMap((d) => [...d.data]);
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = 0; j < px.length; j += 4) {
        r += px[j];
        g += px[j + 1];
        b += px[j + 2];
        n++;
      }
      setBg((s) => ({ ...s, [k]: `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})` }));
    } catch {
      /* 読めない画像は既定の背景のまま */
    }
  };

  const stage = bg[i] ?? "#ffffff";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative group rounded-[28px] overflow-hidden transition-colors duration-500" style={{ backgroundColor: stage }}>
        <div
          ref={strip}
          className="snap-x-strip flex overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            const n = Math.round(el.scrollLeft / el.clientWidth);
            if (n !== i) setI(n);
          }}
        >
          {images.map((img, k) => (
            <div key={img.src} className="w-full shrink-0 aspect-[16/9] relative transition-colors duration-500" style={{ backgroundColor: bg[k] }}>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 1000px) 100vw, 980px"
                priority={k === 0}
                className="object-contain"
                onLoad={(e) => sampleEdge(k, e.currentTarget)}
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            {[
              { label: "前の画像", d: -1, Icon: ChevronLeft, pos: "left-4" },
              { label: "次の画像", d: 1, Icon: ChevronRight, pos: "right-4" },
            ].map(({ label, d, Icon, pos }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={() => go(i + d)}
                className={`hidden sm:flex absolute ${pos} top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/70 backdrop-blur items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer`}
              >
                <Icon size={20} />
              </button>
            ))}
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-2" role="tablist" aria-label="画像">
          {images.map((img, k) => (
            <button
              key={img.src}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`画像 ${k + 1}`}
              onClick={() => go(k)}
              className={`h-2 rounded-full transition-all cursor-pointer ${k === i ? "w-6 bg-ink" : "w-2 bg-line hover:bg-faint"}`}
            />
          ))}
        </div>
      )}
      {images[i]?.credit && <p className="m-0 text-center text-[11px] text-faint">画像：{images[i].credit}</p>}
    </div>
  );
}
