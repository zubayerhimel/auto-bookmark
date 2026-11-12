import { cn } from "@/lib/utils";

const ribbons = [
  { x: 10, h: 30, fill: "#6F8FF5" },
  { x: 26, h: 46, fill: "#F5D547" },
  { x: 42, h: 38, fill: "#4FC2B0" },
];

/** Brand mark: three category ribbons hanging from a sheet. Keep in sync with src/app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8 shrink-0", className)}>
      <defs>
        <clipPath id="logo-tile">
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="14" fill="#1B2430" />
      <g clipPath="url(#logo-tile)">
        {ribbons.map((r) => (
          <path key={r.x} d={`M${r.x} 0h12v${r.h}l-6-5-6 5z`} fill={r.fill} />
        ))}
      </g>
    </svg>
  );
}
