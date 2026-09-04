import { cn } from "@/lib/utils";

type OrganizationLogoProps = {
  name: string;
  url?: string | null;
  size?: "sm" | "md";
  className?: string;
};

function initials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "OA";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function OrganizationLogo({
  name,
  url,
  size = "md",
  className,
}: OrganizationLogoProps) {
  const dimension = size === "sm" ? "size-8" : "size-10";

  if (url) {
    return (
      // Uploaded logos are untrusted raster files served from a signed URL.
      // Never render uploaded SVG/HTML into the document.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={cn(
          dimension,
          "shrink-0 rounded-lg object-contain",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        dimension,
        "grid shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--client-primary)_12%,white)] text-[0.65rem] font-medium tracking-wide text-[var(--client-primary)]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
