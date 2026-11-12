import type { Use } from "./types";

/** クライアントでも使う表示ラベル（カタログ本体を読み込まないよう分離） */
export const USE_LABEL: Record<Use, string> = {
  office: "一般事務",
  design: "デザイン・映像",
  dev: "開発",
  sales: "営業・外回り",
  cad: "CAD・3D",
};
