import type { ProductStatus } from "@/lib/types";

export const STATUS_LABEL: Record<ProductStatus, string> = { draft: "下書き", published: "公開中", archived: "非公開" };
export const STATUS_TONE: Record<ProductStatus, string> = { draft: "bg-warn-soft text-warn", published: "bg-ok-soft text-ok", archived: "bg-hair text-mute" };
export const ROLE_LABEL = { user: "会員", editor: "編集者", admin: "管理者" } as const;
export const SITE_KIND_LABEL = { maker: "メーカー", shop: "購入先", rental: "レンタル会社", other: "その他" } as const;
