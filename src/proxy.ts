import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSql } from "@/lib/db";
import { getProfile, hasRole } from "@/lib/repo-accounts";

/**
 * 1. Supabase Auth のセッション Cookie を更新する（ログイン中のリクエストだけ）。
 * 2. /admin・/account は未ログインならログイン画面へ。
 * 3. /admin は editor 以上でなければ 404（ストリーミング前に弾くので管理画面の枠も見せない）。
 *    各ページ・Server Action でも requireRole で必ず確認する（二重の確認）。
 */
export async function proxy(request: NextRequest) {
  const protectedPath = /^\/(admin|account)(\/|$)/.test(request.nextUrl.pathname);
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!hasSession || !url || !key) {
    if (protectedPath) return toLogin(request);
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && protectedPath) return toLogin(request);
  if (data.user && /^\/admin(\/|$)/.test(request.nextUrl.pathname)) {
    const sql = getSql();
    const profile = sql ? await getProfile(sql, data.user.id) : null;
    if (!hasRole(profile, "editor")) return new NextResponse("Not Found", { status: 404 });
  }
  return response;
}

function toLogin(request: NextRequest) {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // 静的ファイル・画像・API（JSON / MCP）は対象外
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|llms.txt|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
