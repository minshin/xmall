/** 商品画像が用意できるまでの簡易イラスト（実運用ではメーカー提供画像・撮影画像に置き換え） */
export function DeviceIllustration({ color, id, width = 260 }: { color: string; id: string; width?: number }) {
  const gid = `g-${id}`;
  return (
    <svg width={width} height={(width * 170) / 260} viewBox="0 0 260 170" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3A5BD9" />
          <stop offset="1" stopColor="#0E1530" />
        </linearGradient>
      </defs>
      <rect x="40" y="10" width="180" height="118" rx="9" fill={color} />
      <rect x="47" y="17" width="166" height="104" rx="4" fill={`url(#${gid})`} />
      <path d="M14 132h232l-12 14H26z" fill={color} />
      <rect x="112" y="132" width="36" height="4" rx="2" fill="#00000022" />
      <ellipse cx="130" cy="156" rx="112" ry="6" fill="#00000014" />
    </svg>
  );
}
