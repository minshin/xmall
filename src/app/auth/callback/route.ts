import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation";

/**
 * 確認メール・パスワード再設定メール・Google ログインの戻り先。
 * ?code=（PKCE）か ?token_hash=&type= を受け取り、セッション Cookie を作ってから next へ。
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  const dest = url.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = next;
  } else {
    dest.pathname = "/login";
    dest.searchParams.set("error", url.searchParams.get("error_code") ?? "link_invalid");
  }
  return NextResponse.redirect(dest);
}
