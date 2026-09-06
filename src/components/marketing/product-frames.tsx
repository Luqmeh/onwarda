export function ProductFrames() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <article className="mk-card p-5">
        <p className="mk-kicker">Public property</p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--mk-cream)] p-4">
          <div className="h-20 rounded-xl bg-[color-mix(in_srgb,var(--mk-olive)_18%,white)]" />
          <p className="mt-3 text-sm font-medium">Riad Suite</p>
          <p className="text-xs text-[var(--mk-muted)]">Marrakech · Direct booking</p>
        </div>
      </article>
      <article className="mk-card p-5">
        <p className="mk-kicker">Guest portal</p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--mk-cream)] p-4">
          <p className="text-xs tracking-[0.16em] text-[var(--mk-olive)] uppercase">Get ready</p>
          <p className="mt-2 text-sm font-medium">Review house rules</p>
          <div className="mt-3 h-2 rounded-full bg-white">
            <div className="h-2 w-1/2 rounded-full bg-[var(--mk-olive)]" />
          </div>
        </div>
      </article>
      <article className="mk-card p-5">
        <p className="mk-kicker">Operator workspace</p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--mk-cream)] p-4">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white py-3">12 stays</div>
            <div className="rounded-lg bg-white py-3">8 guests</div>
            <div className="rounded-lg bg-white py-3">2 issues</div>
          </div>
        </div>
      </article>
    </div>
  );
}

export function GuestJourneySteps() {
  const steps = [
    "Reservation",
    "Welcome",
    "Guest information",
    "House rules",
    "Arrival",
    "Access",
    "Stay information",
    "Support",
    "Checkout",
  ];

  return (
    <ol className="grid gap-2 md:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step} className="mk-card flex min-h-16 items-center gap-3 px-4 py-3 text-sm">
          <span className="text-[var(--mk-olive)]">{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
