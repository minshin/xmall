"use client";

import { ArrowDown, ArrowUp, CheckCircle2, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import type { AdminState } from "./catalog-actions";

export const input =
  "w-full border border-line rounded-[10px] px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition";

/** Server Action に送るフォーム。保存結果を右下に出す */
export function ActionForm({
  action,
  children,
  submit = "保存",
  className = "flex flex-col gap-4",
}: {
  action: (prev: AdminState, fd: FormData) => Promise<AdminState>;
  children: React.ReactNode;
  submit?: string;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, { ok: false });
  return (
    <form action={run} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary !py-2 !px-5 !text-sm disabled:opacity-60">
          {pending ? "保存中…" : submit}
        </button>
        {state.ok && (
          <span key={state.at} className="inline-flex items-center gap-1.5 text-sm text-ok animate-fade">
            <CheckCircle2 size={16} /> {state.message}
          </span>
        )}
        {state.error && <span className="text-sm text-[#d70015] animate-fade">{state.error}</span>}
      </div>
    </form>
  );
}

// ───────── 行の追加・削除・並べ替えができる表（JSON にして hidden で送る） ─────────

export interface Column {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "url" | "date";
  placeholder?: string;
  wide?: boolean;
}

type Row = Record<string, string>;

function useRows(initial: Row[], blank: Row) {
  const [rows, setRows] = useState<Row[]>(initial);
  return {
    rows,
    set: (i: number, k: string, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r))),
    add: () => setRows((rs) => [...rs, { ...blank }]),
    remove: (i: number) => setRows((rs) => rs.filter((_, j) => j !== i)),
    move: (i: number, d: -1 | 1) =>
      setRows((rs) => {
        const j = i + d;
        if (j < 0 || j >= rs.length) return rs;
        const c = [...rs];
        [c[i], c[j]] = [c[j], c[i]];
        return c;
      }),
  };
}

function RowControls({ i, n, move, remove }: { i: number; n: number; move: (i: number, d: -1 | 1) => void; remove: (i: number) => void }) {
  const b = "p-1.5 rounded-md text-faint hover:text-ink hover:bg-ground disabled:opacity-30 cursor-pointer";
  return (
    <div className="flex sm:flex-col gap-0.5 shrink-0">
      <button type="button" aria-label="上へ" className={b} disabled={i === 0} onClick={() => move(i, -1)}>
        <ArrowUp size={14} />
      </button>
      <button type="button" aria-label="下へ" className={b} disabled={i === n - 1} onClick={() => move(i, 1)}>
        <ArrowDown size={14} />
      </button>
      <button type="button" aria-label="削除" className={`${b} hover:!text-[#d70015]`} onClick={() => remove(i)}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function RowsEditor({ name, columns, initial, addLabel = "行を追加" }: { name: string; columns: Column[]; initial: object[]; addLabel?: string }) {
  const blank = Object.fromEntries(columns.map((c) => [c.key, ""]));
  const r = useRows(initial as Row[], blank);
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(r.rows)} />
      {r.rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-start bg-ground rounded-[12px] p-2.5 animate-fade">
          <div className="flex-1 grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
            {columns.map((c) =>
              c.type === "textarea" ? (
                <textarea
                  key={c.key}
                  aria-label={c.label}
                  placeholder={c.placeholder ?? c.label}
                  value={row[c.key] ?? ""}
                  rows={2}
                  onChange={(e) => r.set(i, c.key, e.target.value)}
                  className={`${input} sm:col-span-full`}
                />
              ) : (
                <input
                  key={c.key}
                  aria-label={c.label}
                  type={c.type ?? "text"}
                  placeholder={c.placeholder ?? c.label}
                  value={row[c.key] ?? ""}
                  onChange={(e) => r.set(i, c.key, e.target.value)}
                  className={`${input} ${c.wide ? "sm:col-span-2" : ""}`}
                />
              ),
            )}
          </div>
          <RowControls i={i} n={r.rows.length} move={r.move} remove={r.remove} />
        </div>
      ))}
      <button type="button" onClick={r.add} className="self-start inline-flex items-center gap-1 text-sm text-link cursor-pointer py-1">
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}

// ───────── 構成（variant）エディタ ─────────

export interface VariantAttr {
  key: string;
  label: string;
  unit: string | null;
  type: "text" | "number" | "boolean" | "enum";
  options: string[];
}
export interface VariantRow {
  code: string;
  label: string;
  attrs: Record<string, string | number | boolean>;
  officialPrice: number | null;
  rentBase: number;
  note: string | null;
}

export function VariantsEditor({ attrs, initial }: { attrs: VariantAttr[]; initial: VariantRow[] }) {
  const toRow = (v: VariantRow): Row => ({
    code: v.code,
    label: v.label,
    officialPrice: v.officialPrice?.toString() ?? "",
    rentBase: v.rentBase ? String(v.rentBase) : "",
    note: v.note ?? "",
    ...Object.fromEntries(attrs.map((a) => [`a:${a.key}`, v.attrs[a.key] === undefined ? "" : String(v.attrs[a.key])])),
  });
  const blank: Row = { code: "", label: "", officialPrice: "", rentBase: "", note: "", ...Object.fromEntries(attrs.map((a) => [`a:${a.key}`, ""])) };
  const r = useRows(initial.map(toRow), blank);
  const json = r.rows.map((row) => ({
    code: row.code.trim(),
    label: row.label.trim(),
    officialPrice: row.officialPrice ? Number(row.officialPrice) : null,
    rentBase: Number(row.rentBase || 0),
    note: row.note.trim() || null,
    attrs: Object.fromEntries(
      attrs
        .filter((a) => row[`a:${a.key}`] !== "")
        .map((a) => {
          const v = row[`a:${a.key}`];
          return [a.key, a.type === "number" ? Number(v) : a.type === "boolean" ? v === "true" : v];
        }),
    ),
  }));
  const field = (i: number, k: string, label: string, type = "text", w = "") => (
    <label className={`flex flex-col gap-1 ${w}`}>
      <span className="text-[11px] text-mute">{label}</span>
      <input type={type} value={r.rows[i][k] ?? ""} onChange={(e) => r.set(i, k, e.target.value)} className={input} />
    </label>
  );
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="variants" value={JSON.stringify(json)} />
      {r.rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-start bg-ground rounded-[12px] p-3 animate-fade">
          <div className="flex-1 grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            {field(i, "code", "コード（例 16-512）", "text", "col-span-2 sm:col-span-1")}
            {field(i, "label", "表示名", "text", "col-span-2")}
            {attrs.map((a) =>
              a.type === "boolean" || a.type === "enum" ? (
                <label key={a.key} className="flex flex-col gap-1">
                  <span className="text-[11px] text-mute">{a.label}</span>
                  <select value={row[`a:${a.key}`]} onChange={(e) => r.set(i, `a:${a.key}`, e.target.value)} className={input}>
                    <option value="">—</option>
                    {(a.type === "boolean" ? ["true", "false"] : a.options).map((o) => (
                      <option key={o} value={o}>
                        {o === "true" ? "あり" : o === "false" ? "なし" : o}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span key={a.key}>{field(i, `a:${a.key}`, `${a.label}${a.unit ? `（${a.unit}）` : ""}`, a.type === "number" ? "number" : "text")}</span>
              ),
            )}
            {field(i, "officialPrice", "メーカー価格（円）", "number")}
            {field(i, "rentBase", "基準月額（円）", "number")}
            {field(i, "note", "メモ")}
          </div>
          <RowControls i={i} n={r.rows.length} move={r.move} remove={r.remove} />
        </div>
      ))}
      <button type="button" onClick={r.add} className="self-start inline-flex items-center gap-1 text-sm text-link cursor-pointer py-1">
        <Plus size={15} /> 構成を追加
      </button>
    </div>
  );
}

// ───────── 画像アップロード ─────────

export function ImageUpload({ name = "files", multiple = true, accept = "image/*" }: { name?: string; multiple?: boolean; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const show = (files: FileList | null) => setPreviews([...(files ?? [])].map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (ref.current && e.dataTransfer.files.length) {
          ref.current.files = e.dataTransfer.files;
          show(e.dataTransfer.files);
        }
      }}
      onClick={() => ref.current?.click()}
      className={`cursor-pointer rounded-[14px] border-2 border-dashed p-5 flex flex-col items-center gap-2 text-sm transition-colors ${
        drag ? "border-brand bg-brand-soft" : "border-line bg-ground hover:border-faint"
      }`}
    >
      <input ref={ref} type="file" name={name} accept={accept} multiple={multiple} className="sr-only" onChange={(e) => show(e.target.files)} />
      {previews.length ? (
        <div className="flex flex-wrap gap-2 justify-center">
          {previews.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element -- ローカルのプレビュー
            <img key={p.url} src={p.url} alt={p.name} className="h-16 w-auto rounded-md bg-white object-contain" />
          ))}
        </div>
      ) : (
        <ImagePlus size={26} strokeWidth={1.5} className="text-faint" />
      )}
      <span className="text-mute">{previews.length ? `${previews.length} 件選択` : "クリックまたはドラッグして画像を選ぶ"}</span>
    </div>
  );
}

/** 削除など、確認してから送るボタン */
export function ConfirmButton({ children, message, className }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
