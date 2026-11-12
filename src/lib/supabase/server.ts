import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase Auth 用のクライアント（ログイン状態は Cookie）。DB の読み書きには使わない（DB は lib/db.ts の postgres 直結）。
 * Server Component から呼ぶと Cookie を書けないので setAll の失敗は無視する（更新は proxy.ts が行う）。
 */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Server Component からは書けない */
        }
      },
    },
  });
}

export const authConfigured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
