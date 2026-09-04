import { cn } from "@/lib/utils";

type OnwardaWordmarkProps = {
  className?: string;
  size?: "sm" | "md";
};

/**
 * Single replacement point for the Onwarda mark.
 * Production artwork is not in the repository yet, so this is a typographic
 * treatment rather than a fabricated SVG of the bee/flower.
 */
export function OnwardaWordmark({ className, size = "md" }: OnwardaWordmarkProps) {
  return (
    <span
      className={cn(
        "font-medium tracking-tight lowercase text-onwarda-olive",
        size === "sm" ? "text-sm" : "text-lg",
        className,
      )}
    >
      onwarda
    </span>
  );
}
