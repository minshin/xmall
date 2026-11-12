/** Storage（バケット media）の公開 URL。path が "/" で始まるものは public/ 配下としてそのまま返す */
export const MEDIA_BUCKET = "media";

export function mediaUrl(path: string): string {
  if (path.startsWith("/") || /^https?:\/\//.test(path)) return path;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
