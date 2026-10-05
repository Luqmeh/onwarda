import { ONWARDA_LOGO_SRC } from "@/config/brand";
import { cn } from "@/lib/utils";

type OnwardaWordmarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
};

const SHEET = { width: 1024, height: 682 };

const CROPS = {
  horizontal: { x: 566, y: 148, width: 376, height: 86 },
  horizontalTagline: { x: 566, y: 148, width: 376, height: 100 },
  stacked: { x: 140, y: 96, width: 244, height: 180 },
} as const;

const HEIGHT = {
  sm: 32,
  md: 40,
  lg: 56,
} as const;

function LogoFrame({
  crop,
  height,
  className,
}: {
  crop: (typeof CROPS)[keyof typeof CROPS];
  height: number;
  className?: string;
}) {
  const scale = height / crop.height;

  return (
    <span
      className={cn("inline-block overflow-hidden", className)}
      style={{ width: crop.width * scale, height }}
      role="img"
      aria-label="Onwarda"
    >
      <img
        src={ONWARDA_LOGO_SRC}
        alt=""
        draggable={false}
        style={{
          width: SHEET.width * scale,
          height: SHEET.height * scale,
          maxWidth: "none",
          marginLeft: -crop.x * scale,
          marginTop: -crop.y * scale,
        }}
      />
    </span>
  );
}

export function OnwardaWordmark({ className, size = "md", tagline = false }: OnwardaWordmarkProps) {
  return (
    <span className={cn("inline-flex", className)}>
      <LogoFrame crop={tagline ? CROPS.horizontalTagline : CROPS.horizontal} height={tagline ? 48 : HEIGHT[size]} />
    </span>
  );
}

export function OnwardaLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      <LogoFrame crop={CROPS.stacked} height={96} />
    </span>
  );
}
