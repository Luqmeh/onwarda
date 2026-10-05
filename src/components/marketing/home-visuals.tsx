export function PropertyScene() {
  return (
    <svg viewBox="0 0 640 760" role="img" aria-label="A quiet courtyard with warm stone, linen, and an olive tree." className="home-scene">
      <title>Courtyard</title>
      <rect width="640" height="760" fill="#efe4d8" />
      <rect x="0" y="520" width="640" height="240" fill="#e4c7b4" />
      <path d="M0 560c120-40 220-20 320 10s220 20 320-30v220H0Z" fill="#d7b39a" />
      <rect x="48" y="48" width="544" height="500" rx="18" fill="#f7efe7" />
      <path d="M120 548V230c0-78 62-140 200-140s200 62 200 140v318" fill="#f3e6da" />
      <path d="M168 548V268c0-52 42-96 152-96s152 44 152 96v280" fill="#e7c3b4" />
      <rect x="300" y="330" width="40" height="218" rx="2" fill="#f8f2ed" />
      <rect x="86" y="120" width="70" height="150" rx="2" fill="#f5d8d3" />
      <path d="M150 470c18-28 28-28 46 0" fill="none" stroke="#77764f" strokeWidth="3" />
      <path d="M162 442c10-16 16-16 26 0" fill="none" stroke="#b2b184" strokeWidth="3" />
      <rect x="168" y="468" width="6" height="80" rx="2" fill="#6d5a45" />
      <rect x="470" y="390" width="70" height="46" rx="6" fill="#efe4d8" />
    </svg>
  );
}

export function HeroCards() {
  const cards = [
    { kicker: "Guest", title: "Welcome to Villa Alba", detail: "Your stay is ready" },
    { kicker: "Arrival", title: "Guest arrival · 15:00", detail: "Door notes are with the guest" },
    { kicker: "Property", title: "Property ready", detail: "Cleaning finished this morning" },
    { kicker: "Stay", title: "Wi-Fi", detail: "Shared only inside the guest portal" },
  ];

  return (
    <ul className="home-cards">
      {cards.map((card) => (
        <li key={card.title} className="home-card">
          <p className="home-card-kicker">{card.kicker}</p>
          <p className="mt-1 text-sm font-medium">{card.title}</p>
          <p className="mt-1 text-xs text-[var(--mk-muted)]">{card.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function JourneyRail() {
  const steps = [
    ["Booked", "The stay exists in the workspace."],
    ["Prepare", "Arrival notes, rules, and Wi-Fi are ready."],
    ["Arrive", "The guest opens one quiet portal."],
    ["Stay", "Guides and support stay close."],
    ["Check out", "The property returns to the team."],
  ];

  return (
    <ol className="home-journey">
      {steps.map(([title, body], index) => (
        <li key={title}>
          <span className="home-journey-index">{index + 1}</span>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--mk-muted)]">{body}</p>
        </li>
      ))}
    </ol>
  );
}

export function WorkspacePanels() {
  const panels = [
    { label: "Property", lines: ["Riad Suite", "Marrakech", "Listed"] },
    { label: "Reservation", lines: ["Upcoming stay", "Direct", "Two nights"] },
    { label: "Cleaning", lines: ["Turnover queued", "Default cleaner", "Checklist ready"] },
    { label: "Ready", lines: ["Arrival notes set", "Guest portal open", "No open issue"] },
  ];

  return (
    <div className="home-panels" aria-hidden="true">
      {panels.map((panel) => (
        <article key={panel.label} className="home-panel">
          <p className="home-card-kicker">{panel.label}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {panel.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
