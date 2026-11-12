import type { NextConfig } from "next";

// 商品画像・favicon は Supabase Storage（バケット media の公開 URL）から配信する
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const isLocalSupabase = !!supabase && ["127.0.0.1", "localhost"].includes(supabase.hostname);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(":", "") as "http" | "https",
            hostname: supabase.hostname,
            port: supabase.port,
            pathname: "/storage/v1/object/public/media/**",
          },
        ]
      : [],
    // ローカルの Supabase（127.0.0.1）から画像最適化するときだけ許可
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
