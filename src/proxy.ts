import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

/** /admin を Basic 認証で守る（ADMIN_USER / ADMIN_PASSWORD 未設定なら常に拒否） */
export function proxy(req: NextRequest) {
  if (isAdminAuthorized(req.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("認証が必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="xmall admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
