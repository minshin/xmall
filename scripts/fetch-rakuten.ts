     1|// scripts/fetch-rakuten.ts — 楽天商品収集用cronスクリプト
     2|//
     3|// 使い方:
     4|//   npx tsx --env-file=.env.local scripts/fetch-rakuten.ts
     5|//
     6|// 上記コマンドをcron jobで定期実行
     7|
     8|import { fetchProducts, toProduct } from '../lib/rakuten/client'
     9|import { createClient } from '@supabase/supabase-js'
    10|
    11|const RAKUTEN_GENRES = {
    12|  'スポーツ・アウトドア': '100433',
    13|  'サーフィン': '565392',
    14|  'ゴルフ': '200162',
    15|  'スノーボード': '565430',
    16|  'スキー': '203083',
    17|  'キャンプ': '566277',
    18|  'アパレル・ファッション': '100227',
    19|  '家電': '100026',
    20|}
    21|
    22|async function main() {
    23|  console.log('=== xmall: Rakuten 商品収集開始 ===')
    24|  console.log('Time:', new Date().toISOString())
    25|
    26|  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    27|  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    28|
    29|  if (!supabaseUrl || !supabaseKey) {
    30|    console.log('⚠️ Supabase未設定 → 商品データを表示のみ')
    31|    // DBなしでも検索結果は確認できる
    32|  }
    33|
    34|  const supabase = supabaseUrl && supabaseKey
    35|    ? createClient(supabaseUrl, supabaseKey)
    36|    : null
    37|
    38|  let totalInserted = 0
    39|  let totalSkipped = 0
    40|
    41|  // 各ジャンルから商品を収集
    42|  for (const [genreName, genreId] of Object.entries(RAKUTEN_GENRES)) {
    43|    console.log(`\n--- ${genreName} (genreId: ${genreId}) ---`)
    44|
    45|    const products = await fetchProducts({
    46|      genreId,
    47|      maxPages: 2, // 1ジャンル60件
    48|    })
    49|
    50|    console.log(`  取得: ${products.length}件`)
    51|
    52|    for (const product of products) {
    53|      if (!supabase) {
    54|        console.log(`  ${product.title} | ¥${product.price} | ${product.shop_name}`)
    55|        continue
    56|      }
    57|
    58|      const { error } = await supabase.from('xmall_products').upsert(
    59|        {
    60|          ...product,
    61|          category: genreName,
    62|          category_id: genreId,
    63|          region: 'jp',
    64|        },
    65|        {
    66|          onConflict: 'source,source_id',
    67|          ignoreDuplicates: false,
    68|        }
    69|      )
    70|
    71|      if (error) {
    72|        if (error.code === '23505') {
    73|          totalSkipped++
    74|        } else {
    75|          console.error(`  Error: ${error.message}`)
    76|        }
    77|      } else {
    78|        totalInserted++
    79|      }
    80|    }
    81|
    82|    // レート制限
    83|    await new Promise(r => setTimeout(r, 1000))
    84|  }
    85|
    86|  // ランキングからも取得
    87|  console.log('\n--- ランキング（総合） ---')
    88|  const rankingRes = await fetch(
    `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Ranking/20260401?` +
    new URLSearchParams({
      applicationId: process.env.RAKUTEN_APPLICATION_ID!,
      accessKey: process.env.RAKUTEN_APPLICATION_SECRET!,
      affiliateId: process.env.RAKUTEN_AFFILIATE_ID!,
      format: 'json',
      period: 'daily',
      page: '1',
    })
    97|  )
    98|  const rankingData = await rankingRes.json()
    99|  if (rankingData.Items) {
   100|    for (const { Item } of rankingData.Items) {
   101|      const product = toProduct(Item)
   102|      if (!supabase) {
   103|        console.log(`  [Rank] ${product.title} | ¥${product.price}`)
   104|        continue
   105|      }
   106|      const { error } = await supabase.from('xmall_products').upsert(
   107|        { ...product, region: 'jp' },
   108|        { onConflict: 'source,source_id', ignoreDuplicates: false }
   109|      )
   110|      if (error && error.code !== '23505') {
   111|        console.error(`  Error: ${error.message}`)
   112|      } else if (!error) {
   113|        totalInserted++
   114|      } else {
   115|        totalSkipped++
   116|      }
   117|    }
   118|  }
   119|
   120|  console.log(`\n=== 完了: ${totalInserted}件追加, ${totalSkipped}件スキップ ===`)
   121|}
   122|
   123|main().catch(console.error)
   124|