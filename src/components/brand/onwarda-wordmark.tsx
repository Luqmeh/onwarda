import { OnwardaMark } from "@/components/brand/onwarda-mark";
import { ONWARDA_TAGLINE } from "@/config/brand";
import { cn } from "@/lib/utils";

type OnwardaWordmarkProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
};

const MARK_CLASS = {
  sm: "h-7 w-[1.35rem]",
  md: "h-9 w-[1.7rem]",
  lg: "h-12 w-9",
} as const;

const TYPE_CLASS = {
  sm: "text-[0.95rem] leading-none",
  md: "text-[1.15rem] leading-none",
  lg: "text-2xl leading-none",
} as const;

export function OnwardaWordmark({ className, size = "md", tagline = false }: OnwardaWordmarkProps) {
  return (
    <span className={cn("text-onwarda-olive", className)}>
      <span className="inline-flex items-center gap-2.5">
        <OnwardaMark decorative className={MARK_CLASS[size]} />
        <span className="min-w-0">
          <span className={cn("block font-medium tracking-tight lowercase", TYPE_CLASS[size])}>
            onwarda
          </span>
          {tagline ? (
            <span className="mt-1.5 block text-[0.58rem] leading-none tracking-[0.22em] text-onwarda-olive/80 uppercase">
              {ONWARDA_TAGLINE}
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

export function OnwardaLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex flex-col items-center text-onwarda-olive", className)}>
      <OnwardaMark decorative className="h-[5.5rem] w-[4.25rem]" />
      <span className="mt-4 text-[2rem] font-medium tracking-tight lowercase md:text-[2.35rem]">
        onwarda
      </span>
      <span className="mt-2.5 text-[0.62rem] tracking-[0.24em] uppercase">{ONWARDA_TAGLINE}</span>
    </span>
  );
}
