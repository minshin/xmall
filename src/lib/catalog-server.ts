import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getSql } from "./db";
import * as cat from "./repo-catalog";
import type { Site } from "./repo-catalog";
import type { Category, Device } from "./types";

/**
 * 画面・API から使うカタログの読み取り（キャッシュ付き）。
 * 管理画面で書き換えたら actions で updateTag(CATALOG_TAG) する。
 */

export const CATALOG_TAG = "catalog";

async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error("[catalog]", e instanceof Error ? e.message : e);
    return fallback;
  }
}

/** 公開中の機種 */
export async function getDevices(): Promise<Device[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const sql = getSql();
  if (!sql) return [];
  return safe([], () => cat.loadProducts(sql));
}

export async function getDevice(slug: string): Promise<Device | undefined> {
  return (await getDevices()).find((d) => d.slug === slug);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const sql = getSql();
  if (!sql) return [];
  return safe([], () => cat.loadCategories(sql));
}

export async function getSites(): Promise<Site[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const sql = getSql();
  if (!sql) return [];
  return safe([], () => cat.loadSites(sql));
}

/** サイト id → favicon URL（クライアントコンポーネントに渡す用） */
export async function getFavicons(): Promise<Record<string, string>> {
  const sites = await getSites();
  return Object.fromEntries(sites.filter((s) => s.faviconUrl).map((s) => [s.id, s.faviconUrl!]));
}

/** 一覧のハイライト・絞り込みに使う variant 項目（品目ごと） */
export async function getVariantAttrs(categoryId: string) {
  const cats = await getCategories();
  return (cats.find((c) => c.id === categoryId)?.attributes ?? []).filter((a) => a.scope === "variant" && (a.highlight || a.filterable));
}
