// components/ProductCard.tsx — Pinterest風商品カード

'use client'

import type { Product } from '@/lib/types'
import Image from 'next/image'
import { ExternalLink, Heart, ShoppingBag } from 'lucide-react'

interface ProductCardProps {
  product: Product
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  rakuten: { label: '楽天', color: 'bg-red-500' },
  amazon: { label: 'Amazon', color: 'bg-amber-500' },
  yahoo: { label: 'Yahoo!', color: 'bg-orange-500' },
  a8net: { label: 'A8.net', color: 'bg-blue-500' },
}

function formatPrice(price: number, currency: string): string {
  if (currency === 'JPY') return `¥${price.toLocaleString()}`
  if (currency === 'USD') return `$${price.toLocaleString()}`
  if (currency === 'AUD') return `A$${price.toLocaleString()}`
  return `${price.toLocaleString()} ${currency}`
}

export default function ProductCard({ product }: ProductCardProps) {
  const badge = SOURCE_BADGES[product.source] || { label: product.source, color: 'bg-gray-500' }

  return (
    <div className="break-inside-avoid mb-4 rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
      {/* 画像 */}
      <a
        href={product.affiliate_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block relative aspect-[3/4] bg-gray-50 overflow-hidden"
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, 300px"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <ShoppingBag size={48} />
          </div>
        )}

        {/* ソースバッジ */}
        <span className={`absolute top-2 left-2 ${badge.color} text-white text-xs font-medium px-2 py-0.5 rounded-full`}>
          {badge.label}
        </span>
      </a>

      {/* 情報 */}
      <div className="p-3 space-y-1">
        <p className="text-xs text-gray-400 truncate">{product.shop_name}</p>
        <h3 className="text-sm font-medium leading-snug line-clamp-2 text-gray-800">
          {product.title}
        </h3>
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-gray-900">
            {formatPrice(product.price, product.currency)}
          </span>
          <a
            href={product.affiliate_url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
          >
            <ExternalLink size={12} />
            詳細
          </a>
        </div>

        {/* 評価 */}
        {product.review_count > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>
              {'★'.repeat(Math.round(product.review_average))}
              {'☆'.repeat(5 - Math.round(product.review_average))}
            </span>
            <span>({product.review_count})</span>
          </div>
        )}
      </div>
    </div>
  )
}
