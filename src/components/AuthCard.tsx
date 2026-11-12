/** ログイン・登録などの小さい中央カード */
export function AuthCard({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[420px] px-4 py-14 sm:py-20 flex flex-col gap-7 animate-rise">
      <div className="text-center">
        <h1 className="m-0 text-[32px] font-semibold">{title}</h1>
        {lead && <p className="m-0 mt-2 text-[17px] text-mute">{lead}</p>}
      </div>
      {children}
    </main>
  );
}
