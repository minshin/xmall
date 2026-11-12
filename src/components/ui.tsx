import Image from "next/image";
import type { Device } from "@/lib/types";
import { DeviceIllustration } from "./DeviceIllustration";

/** サイトのアイコン（favicon）。src が無ければ頭文字の丸 */
export function SiteIcon({ src, name, size = 20 }: { src?: string | null; name: string; size?: number }) {
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- .ico を含むため next/image を使わない
      <img src={src} alt="" width={size} height={size} className="rounded-[5px] shrink-0 bg-white object-contain" style={{ width: size, height: size }} />
    );
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-[5px] bg-hair text-sub font-semibold inline-flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {name.replace(/[（(].*$/, "").trim().slice(0, 1)}
    </span>
  );
}

/** 商品の代表画像（無ければイラスト） */
export function DeviceThumb({
  device,
  sizes = "(max-width: 640px) 100vw, 400px",
  priority,
}: {
  device: Pick<Device, "slug" | "name" | "bodyColor"> & { images?: Device["images"] };
  sizes?: string;
  priority?: boolean;
}) {
  const img = device.images?.[0];
  if (img)
    return (
      <Image src={img.src} alt={img.alt} width={img.width} height={img.height} sizes={sizes} priority={priority} className="w-full h-full object-cover" />
    );
  return (
    <div className="w-full h-full flex items-center justify-center">
      <DeviceIllustration color={device.bodyColor} id={`t-${device.slug}`} width={220} />
    </div>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span aria-label={`評価 ${value}`} className="inline-flex text-[#ff9f0a]" style={{ fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(Math.round(value))}
      <span className="text-line">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}
