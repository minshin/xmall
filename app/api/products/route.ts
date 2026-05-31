     1|// app/api/products/route.ts — 商品一覧API
     2|
     3|import { NextRequest, NextResponse } from 'next/server'
     4|import { createClient } from '@supabase/supabase-js'
     5|import type { PaginatedResponse, Product } from '@/lib/types'
     6|
     7|export const runtime = 'nodejs'
     8|export const dynamic = 'force-dynamic'
     9|
    10|export async function GET(req: NextRequest) {
    11|  const { searchParams } = req.nextUrl
    12|  const category = searchParams.get('category')
    13|  const keyword = searchParams.get('keyword')
    14|  const source = searchParams.get('source')
    15|  const sort = searchParams.get('sort') || 'popular'
    16|  const page = parseInt(searchParams.get('page') || '1', 10)
    17|  const limit = parseInt(searchParams.get('limit') || '30', 10)
    18|
    19|  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    20|    // DB未接続 → 空配列
    21|    return NextResponse.json({ items: [], total: 0, page, hasMore: false } satisfies PaginatedResponse<Product>)
    22|  }
    23|
    24|  const supabase = createClient(
    25|    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    26|    process.env.SUPABASE_SERVICE_ROLE_KEY!
    27|  )
    28|
    29|  let query = supabase.from('xmall_products').select('*', { count: 'exact' })
    30|
    31|  if (category) query = query.eq('category', category)
    32|  if (source) query = query.eq('source', source)
    33|  if (keyword) query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
    34|
    35|  switch (sort) {
    36|    case 'price_asc': query = query.order('price', { ascending: true }); break
    37|    case 'price_desc': query = query.order('price', { ascending: false }); break
    38|    case 'popular': query = query.order('affiliate_rate', { ascending: false }); break
    39|    default: query = query.order('created_at', { ascending: false })
    40|  }
    41|
    42|  const from = (page - 1) * limit
    43|  const { data, count, error } = await query.range(from, from + limit - 1)
    44|
    45|  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    46|
    47|  return NextResponse.json({
    48|    items: data || [],
    49|    total: count || 0,
    50|    page,
    51|    hasMore: count ? from + limit < count : false,
    52|  } satisfies PaginatedResponse<Product>)
    53|}
    54|