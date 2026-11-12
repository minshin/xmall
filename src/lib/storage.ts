/**
 * 画像を Supabase Storage（バケット media）に置き、media 行を作る。
 * service role キーを使うのでサーバー（Server Action・スクリプト）からだけ呼ぶこと。
 * ※ scripts からも使うため "server-only" は付けていない。SUPABASE_SERVICE_ROLE_KEY は NEXT_PUBLIC にしない。
 */
import { createClient } from "@supabase/supabase-js";
import { imageSize } from "image-size";
import type { Sql } from "./db";
import { MEDIA_BUCKET } from "./media";

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(MEDIA_BUCKET);
}

export interface MediaRow {
  id: string;
  path: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  credit: string | null;
  kind: "product" | "favicon" | "other";
  created_at: Date;
}

export function measure(buf: Uint8Array): { width: number | null; height: number | null } {
  try {
    const s = imageSize(buf);
    return { width: s.width ?? null, height: s.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/** 拡張子からの MIME（ブラウザが空の type を送ってくる場合の補完） */
export function mimeOf(filename: string, given?: string): string | null {
  if (given && IMAGE_TYPES[given]) return given;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return Object.entries(IMAGE_TYPES).find(([, e]) => e === ext || (ext === "jpeg" && e === "jpg"))?.[0] ?? null;
}

export async function uploadMedia(
  sql: Sql,
  input: {
    data: Uint8Array;
    mime: string;
    /** バケット内のパス（省略時は kind/年月/ランダム.拡張子） */
    path?: string;
    kind: MediaRow["kind"];
    alt?: string;
    credit?: string | null;
    createdBy?: string | null;
  },
): Promise<MediaRow> {
  const ext = IMAGE_TYPES[input.mime];
  if (!ext) throw new Error(`対応していない画像形式です: ${input.mime}`);
  if (input.data.byteLength > MAX_IMAGE_BYTES) throw new Error("画像は 10MB までです");
  const path = input.path ?? `${input.kind}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await storageClient().upload(path, input.data, { contentType: input.mime, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`アップロードに失敗しました: ${error.message}`);
  const { width, height } = input.mime === "image/svg+xml" ? { width: null, height: null } : measure(input.data);
  const [row] = await sql<MediaRow[]>`
    insert into public.media (path, mime, bytes, width, height, alt, credit, kind, created_by)
    values (${path}, ${input.mime}, ${input.data.byteLength}, ${width}, ${height}, ${input.alt ?? ""}, ${input.credit ?? null},
      ${input.kind}, ${input.createdBy ?? null})
    on conflict (path) do update set mime = excluded.mime, bytes = excluded.bytes, width = excluded.width, height = excluded.height,
      alt = excluded.alt, credit = excluded.credit
    returning *`;
  return row;
}

/** media 行と Storage のファイルを消す（参照している機種・サイトの紐づけは FK で外れる） */
export async function deleteMedia(sql: Sql, id: string): Promise<boolean> {
  const [row] = await sql<{ path: string }[]>`delete from public.media where id = ${id} returning path`;
  if (!row) return false;
  await storageClient().remove([row.path]);
  return true;
}
