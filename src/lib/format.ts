export const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://xmall.jp";
export const SITE_NAME = "xmall";
