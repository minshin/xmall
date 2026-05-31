// lib/rakuten/client.ts — 楽天API Client (v3 openapi)
//
// 公式: https://webservice.rakuten.co.jp/documentation
// エンドポイント: https://openapi.rakuten.co.jp/ichibams/api/{API名}/{バージョン}
// 認証: applicationId + accessKey + アプリケーションURLと同じRefererが必要

import type {
  RakutenSearchResponse,
  RakutenRankingResponse,
  RakutenItem,
  Product,
} from '@/lib/types'
import https from 'node:https'

const API_DOMAIN = 'https://openapi.rakuten.co.jp/ichibams/api'

interface RakutenConfig {
  applicationId: string
  accessKey: string
  affiliateId: string
}

let _config: RakutenConfig | null = null

function getConfig(): RakutenConfig {
  if (_config) return _config
  const applicationId = process.env.RAKUTEN_APPLICATION_ID
  const accessKey = process.env.RAKUTEN_APPLICATION_SECRET
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID
  if (!applicationId || !accessKey || !affiliateId) {
    throw new Error('Rakuten API not configured. Set RAKUTEN_APPLICATION_ID, RAKUTEN_APPLICATION_SECRET, RAKUTEN_AFFILIATE_ID')
  }
  _config = { applicationId, accessKey, affiliateId }
  return _config
}

/** Node.js fetchではRefererヘッダーがブロックされるためhttps.getを使う */
function rakutenFetch(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        Referer: 'https://www.xmall.jp/',
        Origin: 'https://www.xmall.jp',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Rakuten API error: ${res.statusCode} ${data}`))
          return
        }
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error(`Rakuten API parse error: ${data.substring(0, 200)}`))
        }
      })
    }).on('error', reject)
  })
}

function baseParams(): Record<string, string> {
  const { applicationId, accessKey, affiliateId } = getConfig()
  return {
    format: 'json',
    applicationId,
    accessKey,
    affiliateId,
  }
}

/** 楽天商品検索API (IchibaItem/Search) */
export async function searchItems(params: {
  keyword?: string
  genreId?: string
  shopCode?: string
  page?: number
  hits?: number
  sort?: string
  minPrice?: number
  maxPrice?: number
  postageFlag?: number
  availability?: number
}): Promise<RakutenSearchResponse> {
  const query = new URLSearchParams(
    Object.entries({ ...baseParams(), ...params })
      .filter(([_, v]) => v != null)
      .map(([k, v]) => [k, String(v)])
  )

  const url = `${API_DOMAIN}/IchibaItem/Search/20260401?${query}`
  return rakutenFetch(url)
}

/** 楽天商品ランキングAPI — 未対応（v3 openapiにRankingエンドポイントなし） */
export async function getRanking(_params: {
  genreId?: string
  page?: number
  period?: 'realtime' | 'daily' | 'weekly' | 'monthly'
}): Promise<RakutenRankingResponse> {
  throw new Error('Ranking API not available on v3 openapi endpoint')
}

/** RakutenItem → 内部Productに変換 */
export function toProduct(item: RakutenItem, region: string = 'jp'): Omit<Product, 'id' | 'created_at' | 'updated_at'> {
  return {
    source: 'rakuten',
    source_id: item.itemCode,
    title: item.itemName,
    description: item.catchcopy || '',
    price: item.itemPrice,
    currency: 'JPY',
    image_url: item.mediumImageUrls?.[0]?.imageUrl || item.smallImageUrls?.[0]?.imageUrl || '',
    image_urls: [
      ...(item.mediumImageUrls || []).map(u => u.imageUrl),
      ...(item.smallImageUrls || []).map(u => u.imageUrl),
    ],
    affiliate_url: item.affiliateUrl || item.itemUrl,
    product_url: item.itemUrl,
    category: item.genreId || '',
    category_id: item.genreId || '',
    tags: [item.brandName].filter(Boolean),
    region: region as any,
    shop_name: item.shopName,
    shop_code: item.shopCode,
    source_updated_at: new Date().toISOString(),
    review_count: item.reviewCount || 0,
    review_average: item.reviewAverage || 0,
    affiliate_rate: item.pointRate || 0,
  }
}

/** 一括検索（キーワード or ジャンルから商品を取得） */
export async function fetchProducts(params: {
  keyword?: string
  genreId?: string
  maxPages?: number
}): Promise<Omit<Product, 'id' | 'created_at' | 'updated_at'>[]> {
  const pageCount = params.maxPages || 3
  const all: Omit<Product, 'id' | 'created_at' | 'updated_at'>[] = []

  for (let page = 1; page <= pageCount; page++) {
    const result = await searchItems({
      keyword: params.keyword,
      genreId: params.genreId,
      page,
      hits: 30,
      sort: '-affiliateRate',
    })

    if (!result.Items?.length) break

    for (const { Item } of result.Items) {
      all.push(toProduct(Item))
    }

    if (result.last) break

    await new Promise(r => setTimeout(r, 1000))
  }

  return all
}
