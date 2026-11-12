/**
 * 計測（GA4）。NEXT_PUBLIC_GA_ID が無い環境では何もしない。
 * 送るのはページの行動だけ（会員のメールアドレスなど個人を特定できる値は送らない）。
 *
 * イベント：
 *   outbound_click  レンタル会社・メーカーのサイトへ移動（company, device, kind: rental|maker）
 *   inquiry_open    相談フォームを開いた（device）
 *   inquiry_submit  相談を送信した（device）
 *   favorite        お気に入りに追加（device）
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

export function track(event: string, params: Record<string, string | number | undefined> = {}) {
  try {
    window.gtag?.("event", event, params);
  } catch {
    /* 計測の失敗で画面を止めない */
  }
}
