import type { Use } from "./types";

/**
 * サイト内の URL（検索エンジンに載せるページの形を 1 か所で決める）。
 *
 *   /{品目}                      品目のトップ（例：/laptop）
 *   /{品目}/{機種}               機種ページ（例：/laptop/thinkpad-e15-gen2）
 *   /{品目}/brand/{メーカー}     メーカー別
 *   /{品目}/price/{価格帯}       月額の価格帯別
 *   /{品目}/use/{用途}           用途別
 *
 * 機種の slug に brand / price / use は使えない（validation-admin で弾く）。
 * 旧 URL /pc/{機種} は恒久リダイレクト。
 */

export const RESERVED_SLUGS = ["brand", "price", "use"];

export const productPath = (d: { categoryId: string; slug: string }) => `/${d.categoryId}/${d.slug}`;
export const categoryPath = (categoryId: string) => `/${categoryId}`;
export const brandPath = (categoryId: string, brandId: string) => `/${categoryId}/brand/${brandId}`;
export const pricePath = (categoryId: string, band: string) => `/${categoryId}/price/${band}`;
export const purposePath = (categoryId: string, use: Use) => `/${categoryId}/use/${use}`;
