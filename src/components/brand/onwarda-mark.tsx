import { ONWARDA_COLOR_TOKENS } from "@/config/brand";
import { cn } from "@/lib/utils";

type OnwardaMarkProps = {
  className?: string;
  decorative?: boolean;
};

export function OnwardaMark({ className, decorative = false }: OnwardaMarkProps) {
  return (
    <svg
      viewBox="0 0 80 108"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Onwarda"}
    >
      <g
        stroke={ONWARDA_COLOR_TOKENS.olive}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M27.6 16.4 C25.4 13.2 24 11.4 23.4 10.6" />
        <path d="M29.6 15.8 C28.4 12.6 27.6 11 27 10.2" />
        <circle cx="30.8" cy="18.4" r="2.25" />
        <ellipse cx="39.4" cy="19.2" rx="5.8" ry="3.2" />
        <path d="M36.6 16.4 v5.6" />
        <path d="M39.4 16.2 v6" />
        <path d="M42.2 16.6 v5.2" />
        <path d="M45.8 20.2 C47.2 21.4 48.4 22.2 49.4 22.6" />
        <ellipse cx="36.8" cy="13.8" rx="3.5" ry="2.15" fill={ONWARDA_COLOR_TOKENS.cream} />
        <ellipse cx="42.2" cy="14.2" rx="3.15" ry="2" fill={ONWARDA_COLOR_TOKENS.cream} />
      </g>
      <path
        d="M40 79 C35.6 62 34.2 42 40 24 C45.8 42 44.4 62 40 79Z"
        fill={ONWARDA_COLOR_TOKENS.coral}
      />
      <path
        d="M40 79 C24 68 14 52 20 34 C29 42 35 60 40 79Z"
        fill={ONWARDA_COLOR_TOKENS.coral}
      />
      <path
        d="M40 79 C56 68 66 52 60 34 C51 42 45 60 40 79Z"
        fill={ONWARDA_COLOR_TOKENS.coral}
      />
      <path
        d="M40 81 C25 78 12 88 16 102 C27 95 35 87 40 81Z"
        fill={ONWARDA_COLOR_TOKENS.olive}
      />
      <path
        d="M40 81 C55 78 68 88 64 102 C53 95 45 87 40 81Z"
        fill={ONWARDA_COLOR_TOKENS.olive}
      />
    </svg>
  );
}
