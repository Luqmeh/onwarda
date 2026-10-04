const JOURNEY = [
  "Reservation",
  "Welcome",
  "Guest details",
  "House rules",
  "Arrival",
  "Access",
  "Stay",
  "Support",
  "Checkout",
] as const;

export function HomeHeroVisual() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl" aria-hidden="true">
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <HomePropertyFrame />
        <HomeGuestFrame featured />
        <HomeOperatorFrame compact />
      </div>
    </div>
  );
}

export function HomePropertyFrame({ compact = false }: { compact?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-[1.6rem] border border-[var(--mk-line)] bg-[var(--mk-paper)]">
      <div className="flex h-40 items-end bg-[linear-gradient(165deg,color-mix(in_srgb,var(--mk-blush)_70%,white),color-mix(in_srgb,var(--mk-coral)_22%,var(--mk-cream)))] px-5 pb-4">
        <div>
          <p className="text-[0.65rem] tracking-[0.18em] text-[var(--mk-olive)] uppercase">Public property</p>
          <p className="mt-1 text-lg font-medium tracking-tight">Riad Suite</p>
        </div>
      </div>
      <figcaption className="space-y-3 px-5 py-5">
        <p className="text-sm text-[var(--mk-muted)]">Marrakech, Morocco · Sleeps 4</p>
        {!compact ? (
          <ul className="flex flex-wrap gap-2 text-xs text-[var(--mk-muted)]">
            {["Wifi", "Kitchen", "Patio", "Parking"].map((item) => (
              <li key={item} className="rounded-full border border-[var(--mk-line)] px-2.5 py-1">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-sm font-medium text-[var(--mk-olive)]">Enquire or book</p>
      </figcaption>
    </figure>
  );
}

export function HomeGuestFrame({ featured = false }: { featured?: boolean }) {
  return (
    <figure
      className={`overflow-hidden rounded-[1.7rem] border border-[var(--mk-line)] bg-[var(--mk-paper)] ${featured ? "lg:mt-8" : ""}`}
    >
      <div className="border-b border-[var(--mk-line)] px-5 py-4">
        <p className="text-[0.65rem] tracking-[0.18em] text-[var(--mk-olive)] uppercase">Guest portal</p>
        <p className="mt-1 text-sm font-medium">Riad Suite</p>
        <p className="text-xs text-[var(--mk-muted)]">Riad Atlas</p>
      </div>
      <figcaption className="space-y-3 px-5 py-5">
        <p className="text-[0.65rem] tracking-[0.16em] text-[var(--mk-olive)] uppercase">Get ready</p>
        <p className="text-sm font-medium">Review house rules</p>
        <div className="h-1.5 rounded-full bg-[var(--mk-cream)]">
          <div className="h-1.5 w-1/2 rounded-full bg-[var(--mk-coral)]" />
        </div>
        <p className="text-xs text-[var(--mk-muted)]">1 of 2 complete</p>
      </figcaption>
      <div className="grid grid-cols-5 border-t border-[var(--mk-line)] px-2 py-3 text-center text-[0.62rem] text-[var(--mk-muted)]">
        {["Stay", "Arrival", "Guides", "Help", "Checkout"].map((item, index) => (
          <span key={item} className={index === 0 ? "font-medium text-[var(--mk-olive)]" : undefined}>
            {item}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function HomeOperatorFrame({ compact = false }: { compact?: boolean }) {
  const metrics = [
    ["Properties", "3"],
    ["Stays", "12"],
    ["Guests", "8"],
    ["Issues", "2"],
  ];

  return (
    <figure className="overflow-hidden rounded-[1.6rem] border border-[var(--mk-line)] bg-[var(--mk-paper)]">
      <div className="border-b border-[var(--mk-line)] px-5 py-4">
        <p className="text-[0.65rem] tracking-[0.18em] text-[var(--mk-olive)] uppercase">Operator workspace</p>
        <p className="mt-1 text-sm font-medium">Welcome to Riad Atlas</p>
      </div>
      <figcaption className={`grid gap-2 px-5 py-5 ${compact ? "grid-cols-2" : "grid-cols-4"}`}>
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[color-mix(in_srgb,var(--mk-sage)_18%,var(--mk-cream))] px-3 py-3">
            <p className="text-lg font-medium tracking-tight">{value}</p>
            <p className="text-[0.65rem] text-[var(--mk-muted)]">{label}</p>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

export function HomeJourney() {
  return (
    <ol className="flex gap-3 overflow-x-auto pb-2 md:flex-wrap md:overflow-visible">
      {JOURNEY.map((step, index) => (
        <li key={step} className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-[var(--mk-ink)]">{step}</span>
          {index < JOURNEY.length - 1 ? (
            <span aria-hidden="true" className="text-[var(--mk-sage)]">
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
