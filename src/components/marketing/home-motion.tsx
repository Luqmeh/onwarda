"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Seen({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSeen(true);
        observer.disconnect();
      },
      { threshold: 0.28 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`home-motion${seen ? " is-seen" : ""}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

const HOTSPOTS = [
  { id: "arrival", label: "Arrival", detail: "How the guest comes in can sit with the property record." },
  { id: "stay", label: "The room", detail: "A captured walkthrough is an optional service, shown here as a preview." },
  { id: "notes", label: "House notes", detail: "Rules, Wi-Fi, and guides stay on the same property the guest portal reads." },
] as const;

export function TourPreview() {
  const [active, setActive] = useState<(typeof HOTSPOTS)[number]["id"]>("stay");
  const current = HOTSPOTS.find((spot) => spot.id === active) ?? HOTSPOTS[1];

  return (
    <div className="home-tour-stage">
      <div className="home-tour-room" role="img" aria-label="Illustrated interior of a sample property, with three points of interest.">
        <span className="home-tour-light" />
        <span className="home-tour-floor" />
        <span className="home-tour-window" />
        <span className="home-tour-seat" />
        {HOTSPOTS.map((spot) => (
          <button
            key={spot.id}
            type="button"
            className={`home-hotspot home-hotspot-${spot.id}${active === spot.id ? " is-active" : ""}`}
            aria-pressed={active === spot.id}
            onClick={() => setActive(spot.id)}
          >
            <span className="sr-only">{spot.label}</span>
          </button>
        ))}
      </div>
      <aside className="home-tour-note">
        <p className="home-card-kicker">Preview</p>
        <p className="mt-2 font-medium">{current.label}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">{current.detail}</p>
      </aside>
    </div>
  );
}
