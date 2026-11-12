import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "個人情報の取り扱い",
  alternates: { canonical: "/privacy" },
};

// TODO: 公開前に法務確認。下書き。
export default function PrivacyPage() {
  const items: [string, string][] = [
    ["取得する情報", "相談フォームに入力された会社名・担当者名・メールアドレス・電話番号・都道府県・台数・利用期間・ご要望、会員登録の情報、口コミの投稿内容、および「お気に入り」「参考になった」の操作を識別するためのCookie（ランダムなID）を取得します。"],
    ["利用目的", "ご相談への回答とレンタル会社のご案内、口コミの掲載と不正投稿の防止、サービスの改善に利用します。"],
    ["第三者への提供", "ご相談の内容をレンタル会社へお渡しする場合は、事前にお客様の同意を得ます。それ以外の第三者には、法令に基づく場合を除き提供しません。"],
    ["口コミ", "口コミは運営が確認してから掲載します。個人や会社を特定できる情報は掲載しません。"],
    ["Cookie", "「お気に入り」「参考になった」の重複防止と連続投稿の防止のために、ログイン不要の匿名IDをCookieに保存します。広告目的のトラッキングには使いません。"],
    ["アクセス解析", "サービス改善のため Google アナリティクス（Google LLC）を利用し、Cookie を使ってページの閲覧やリンクのクリックなどの利用状況を収集します。氏名・メールアドレスなど個人を特定できる情報は送信しません。収集されたデータは Google のプライバシーポリシーに基づいて管理されます。ブラウザの設定や Google アナリティクス オプトアウト アドオンで無効にできます。"],
    ["開示・訂正・削除", "ご本人からの開示・訂正・削除のご請求には、ご本人確認のうえ対応します。"],
    ["事業者", "ZUX株式会社（東京都）"],
  ];
  return (
    <main className="mx-auto max-w-[820px] px-6 py-8 flex flex-col gap-5">
      <h1 className="m-0 text-[24px] font-bold">個人情報の取り扱い</h1>
      <div className="card p-6 flex flex-col gap-5">
        {items.map(([h, body]) => (
          <section key={h}>
            <h2 className="m-0 mb-1.5 text-base font-bold">{h}</h2>
            <p className="m-0 text-sm leading-loose">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
