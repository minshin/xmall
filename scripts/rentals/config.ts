import { resolve } from "node:path";
import type { RentalCompanyData, RentalListingData, SiteScraper } from "./lib";
import { busters } from "./sites/busters";
import { inversenet } from "./sites/inversenet";
import { rentalmarket } from "./sites/rentalmarket";
import { rentio } from "./sites/rentio";
import { tamaya } from "./sites/tamaya";

/** 取得対象の会社（robots.txt で商品ページの取得が許可されていることを確認済み：2026-11-12） */
export const SITES: SiteScraper[] = [rentio, tamaya, busters, rentalmarket, inversenet];

export const DATA_FILE = resolve(import.meta.dirname, "../../supabase/data/rental-listings.json");

export interface RentalDataFile {
  generatedAt: string;
  companies: RentalCompanyData[];
  listings: RentalListingData[];
}
