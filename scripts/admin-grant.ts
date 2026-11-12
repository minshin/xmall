/**
 * 会員に管理画面の権限を付ける（最初の管理者を作るとき用。以後は管理画面の「会員」から変更できる）。
 *
 *   npm run admin:grant -- you@example.com            → admin
 *   npm run admin:grant -- you@example.com editor     → editor
 *
 * 先にサイトでアカウントを作成（メール確認まで）しておくこと。
 */
import postgres from "postgres";

async function main() {
  const [email, role = "admin"] = process.argv.slice(2);
  if (!email || !["user", "editor", "admin"].includes(role)) {
    console.error("使い方: npm run admin:grant -- <メールアドレス> [admin|editor|user]");
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const rows = await sql`update public.profiles set role = ${role}::public.user_role, updated_at = now() where lower(email) = lower(${email}) returning email, role`;
    if (!rows.length) {
      console.error(`${email} の会員が見つかりません。先にサイトでアカウントを作成してください。`);
      process.exit(1);
    }
    console.log(`${rows[0].email} を ${rows[0].role} にしました`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
