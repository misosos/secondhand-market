// Same mark as the site favicon (src/app/icon.svg) — kept as an inline SVG
// here (rather than an <img> pointing at /icon.svg) so it stays crisp at
// arbitrary sizes and never triggers a second network request.
//
// The mark is a manila swing tag, the literal object the "가격표를 다시
// 쓰다" design direction is built around — not an abstract monogram.
// Colors are fixed (not theme tokens): a brand mark should read the same
// in light and dark, like ink on a physical tag would.
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M4 3 H29 V29 H4 L1 16 Z" fill="#dda92e" stroke="#23261f" strokeWidth={1.4} strokeLinejoin="round" />
      <circle cx="8.5" cy="16" r="2.6" fill="#f4f1e6" stroke="#23261f" strokeWidth={1.4} />
    </svg>
  );
}
