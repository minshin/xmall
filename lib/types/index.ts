// lib/types/index.ts — xmall 共有型定義

export type ProductSource = 'rakuten' | 'amazon' | 'yahoo' | 'a8net'

export type ProductRegion = 'jp' | 'au' | 'us' | 'global'

export interface Product {
  id: string
  source: ProductSource
  source_id: string
  title: string
  description: string
  price: number
  currency: string
  image_url: string
  image_urls: string[]
  affiliate_url: string
  product_url: string
  category: string
  category_id: string
  tags: string[]
  region: ProductRegion
  shop_name: string
  shop_code: string
  source_updated_at: string
  review_count: number
  review_average: number
  affiliate_rate: number
  created_at: string
  updated_at: string
}

export interface RakutenItem {
  itemName: string
  itemPrice: number
  itemUrl: string
  affiliateUrl: string
  smallImageUrls: { imageUrl: string }[]
  mediumImageUrls: { imageUrl: string }[]
  shopName: string
  shopCode: string
  itemCode: string
  genreId: string
  reviewCount: number
  reviewAverage: number
  pointRate: number
  postageFlag: number
  availability: number
  shipOverseasFlag: number
  shipOverseasArea: string
  brandName: string
  catchcopy: string
  taxFlag: number
}

export interface RakutenSearchResponse {
  Items: { Item: RakutenItem }[]
  pageCount: number
  count: number
  first: number
  last: number
  page: number
  hits: number
  carrier: number
  total: number
  GenreInformation?: any[]
  TagInformation?: any[]
}

export interface RakutenRankingResponse {
  Items: { Item: RakutenItem }[]
  title: string
  lastBuildDate: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  hasMore: boolean
}

export interface ProductQuery {
  category?: string
  keyword?: string
  source?: ProductSource
  region?: ProductRegion
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular'
  page?: number
  limit?: number
}
