// Same mark as the site favicon (src/app/icon.svg) — kept as an inline SVG
// here (rather than an <img> pointing at /icon.svg) so it stays crisp at
// arbitrary sizes and never triggers a second network request.
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0071e3" />
      <g transform="translate(6.5, 6.5) scale(0.79)">
        <path
          d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="7.5" r="1.3" fill="#ffffff" />
      </g>
    </svg>
  );
}
