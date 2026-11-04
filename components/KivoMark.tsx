/**
 * KIVO atlas mark: an aerial map tile with one illuminated route.
 * A rounded tile and faint street cross carry the atlas metaphor; the
 * kinked route and its square arrival signal stand for a lived journey
 * with a turn — and for the transfer KIVO surfaces. No circles, no
 * generic nodes: the mark reads as a map, not decoration.
 */
export default function KivoMark({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect
        x="5"
        y="5"
        width="22"
        height="22"
        rx="5"
        stroke="currentColor"
        strokeWidth={2}
        opacity={0.45}
      />
      <path
        d="M5 16h22 M16 5v22"
        stroke="currentColor"
        strokeWidth={1.4}
        opacity={0.3}
      />
      <path
        d="M9.5 23.5 L14.5 17.5 L18 19.5 L22.5 10.5"
        stroke="var(--accent)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="20.6" y="8.6" width="3.8" height="3.8" rx={1} fill="var(--accent)" />
    </svg>
  );
}
