import "server-only";
import { cacheLife } from "next/cache";

/** Supabase Auth で有効になっているログイン方法（Google のボタンを出すかどうか） */
export async function enabledProviders(): Promise<{ google: boolean }> {
  "use cache";
  cacheLife("minutes");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { google: false };
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const j = (await r.json()) as { external?: Record<string, boolean> };
    return { google: !!j.external?.google };
  } catch {
    return { google: false };
  }
}
