"use client";

import Image from "next/image";
import { Check, ChevronLeft, ChevronRight, Images, Share } from "lucide-react";
import { useRef, useState } from "react";
import type { Device } from "@/lib/types";
import { DeviceIllustration } from "./DeviceIllustration";

/**
 * 商品画像ギャラリー（EC の商品ページ型）：大きい画像＋枚数表示＋サムネイル、右上に共有・お気に入り。
 * 画像は切り抜かずに全体を見せ、背景は画像の四隅の色に合わせる。
 */
export function Gallery({
  device,
  actions,
}: {
  device: Pick<Device, "slug" | "name" | "bodyColor" | "images">;
  /** 右上に置くボタン（お気に入りなど。サーバーコンポーネントを差し込める） */
  actions?: React.ReactNode;
}) {
  const images = device.images ?? [];
  const [i, setI] = useState(0);
  const [bg, setBg] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);
  const strip = useRef<HTMLDivElement>(null);

  const go = (n: number) => {
    const next = (n + images.length) % images.length;
    setI(next);
    const el = strip.current?.children[next] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const share = async () => {
    const url = location.href.split("#")[0];
    try {
      if (navigator.share) await navigator.share({ title: device.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* キャンセル */
    }
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
      /* 読めない画像は白のまま */
    }
  };

  const btn = "size-10 rounded-full bg-white/90 backdrop-blur border border-line flex items-center justify-center cursor-pointer hover:bg-white transition-colors";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative group rounded-[16px] overflow-hidden border border-hair transition-colors duration-500" style={{ backgroundColor: bg[i] ?? "#fff" }}>
        {images.length ? (
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
              <div key={img.src} className="w-full shrink-0 aspect-[4/3] relative" style={{ backgroundColor: bg[k] }}>
                <Image src={img.src} alt={img.alt} fill sizes="(max-width: 1024px) 100vw, 560px" priority={k === 0} className="object-contain" onLoad={(e) => sampleEdge(k, e.currentTarget)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="aspect-[4/3] flex items-center justify-center bg-white">
            <DeviceIllustration color={device.bodyColor} id={`hero-${device.slug}`} width={320} />
          </div>
        )}

        <div className="absolute top-3 right-3 flex gap-2">
          <button type="button" aria-label="共有" title={copied ? "URL をコピーしました" : "共有"} onClick={share} className={btn}>
            {copied ? <Check size={17} className="text-ok" /> : <Share size={17} />}
          </button>
          {actions && <span className={btn}>{actions}</span>}
        </div>

        {images.length > 1 && (
          <>
            {[
              { label: "前の画像", d: -1, Icon: ChevronLeft, pos: "left-2" },
              { label: "次の画像", d: 1, Icon: ChevronRight, pos: "right-2" },
            ].map(({ label, d, Icon, pos }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={() => go(i + d)}
                className={`hidden sm:flex absolute ${pos} top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 backdrop-blur items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer`}
              >
                <Icon size={18} />
              </button>
            ))}
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 text-white text-xs px-2.5 py-1 tabular-nums">
              <Images size={13} aria-hidden="true" />
              {i + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto snap-x-strip">
          {images.map((img, k) => (
            <button
              key={img.src}
              type="button"
              aria-label={`画像 ${k + 1}`}
              aria-pressed={k === i}
              onClick={() => go(k)}
              className={`relative w-16 shrink-0 aspect-square rounded-[8px] overflow-hidden cursor-pointer border-2 transition-colors ${k === i ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"}`}
              style={{ backgroundColor: bg[k] ?? "#fff" }}
            >
              <Image src={img.src} alt="" fill sizes="64px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
      {images[i]?.credit && <p className="m-0 text-[11px] text-faint">画像：{images[i].credit}</p>}
    </div>
  );
}
