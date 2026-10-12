export function PropertyScene() {
  return (
    <svg viewBox="0 0 720 840" role="img" aria-label="Illustrated courtyard house in warm stone and olive." className="home-scene">
      <title>Courtyard House</title>
      <rect width="720" height="840" fill="#efe4d8" />
      <rect x="0" y="560" width="720" height="280" fill="#e7d3c4" />
      <path d="M0 620c140-50 250-18 360 16s230 28 360-36v240H0Z" fill="#d9bba4" />
      <rect x="56" y="56" width="608" height="560" rx="28" fill="#f7efe7" />
      <path d="M140 616V250c0-90 70-160 220-160s220 70 220 160v366" fill="#f3e6da" />
      <path d="M196 616V292c0-60 48-108 164-108s164 48 164 108v324" fill="#e8c6b6" />
      <rect x="338" y="360" width="44" height="256" rx="3" fill="#f8f2ed" />
      <rect x="96" y="132" width="78" height="168" rx="3" fill="#f5d8d3" />
      <rect x="548" y="168" width="64" height="120" rx="3" fill="#efe4d8" />
      <path d="M168 520c20-32 32-32 52 0" fill="none" stroke="#77764f" strokeWidth="3" />
      <path d="M182 488c12-18 18-18 30 0" fill="none" stroke="#b2b184" strokeWidth="3" />
      <rect x="186" y="516" width="7" height="100" rx="2" fill="#6d5a45" />
      <rect x="470" y="430" width="86" height="52" rx="8" fill="#efe4d8" />
    </svg>
  );
}

export function HeroStack() {
  const cards = [
    { kicker: "Reservation", title: "Upcoming stay", detail: "Two nights · direct" },
    { kicker: "Property", title: "Courtyard House", detail: "Sample property" },
    { kicker: "Operations", title: "Turnover queued", detail: "Checklist with the stay" },
  ];

  return (
    <ul className="home-float">
      {cards.map((card) => (
        <li key={card.kicker} className="home-card">
          <p className="home-card-kicker">{card.kicker}</p>
          <p className="mt-1 text-sm font-medium">{card.title}</p>
          <p className="mt-1 text-xs text-[var(--mk-muted)]">{card.detail}</p>
        </li>
      ))}
    </ul>
  );
}

const LEDGER = [
  ["Property", "Courtyard House", "Description, arrival, rules, and guides on one record."],
  ["Reservation", "Upcoming · two nights", "The stay is attached to that property."],
  ["Guest", "One portal", "Arrival, rules, Wi-Fi, guides, support, and checkout."],
  ["Operations", "Turnover queued", "Cleaning and readiness follow the same stay."],
  ["Team", "What needs attention", "Open issues sit beside today’s arrivals."],
] as const;

export function StayLedger() {
  return (
    <ol className="home-ledger">
      {LEDGER.map(([label, title, detail], index) => (
        <li key={label}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className="home-card-kicker">{label}</p>
            <p className="mt-1 font-medium">{title}</p>
            <p className="mt-1 text-sm text-[var(--mk-muted)]">{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function WorkspaceBoard() {
  return (
    <div className="home-board" aria-hidden="true">
      <div className="home-board-rail">
        <p className="home-card-kicker">Properties</p>
        <p className="home-board-active">Courtyard House</p>
        <p>North Room</p>
        <p>Garden Annex</p>
      </div>
      <div className="home-board-main">
        <p className="home-card-kicker">This stay</p>
        <p className="mt-2 text-lg font-medium">Upcoming · two nights</p>
        <ul>
          <li>Guest portal ready</li>
          <li>House rules on the property</li>
          <li>Turnover queued after checkout</li>
        </ul>
      </div>
    </div>
  );
}

export function OpsBoard() {
  const rows = [
    ["Courtyard House", "Arrival today", "Portal ready"],
    ["North Room", "In house", "No open issue"],
    ["Garden Annex", "Checkout", "Turnover queued"],
  ];

  return (
    <div className="home-ops-board" aria-hidden="true">
      <div className="home-ops-head">
        <p className="home-card-kicker">Today</p>
        <p className="font-medium">Arrivals, stays, and turnover</p>
      </div>
      <ul>
        {rows.map(([property, status, note]) => (
          <li key={property}>
            <span>{property}</span>
            <span>{status}</span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ACCESS = [
  ["01", "Reservation", "Dates sit on the stay."],
  ["02", "Arrival notes", "Instructions travel with the guest portal."],
  ["03", "The stay", "The guest uses one place for the house."],
  ["04", "Checkout", "The team sees the turnover."],
] as const;

export function AccessFilm() {
  return (
    <div className="home-access-film">
      <ol>
        {ACCESS.map(([index, title, detail]) => (
          <li key={index}>
            <span>{index}</span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-[var(--mk-muted)]">{detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="home-pin-card">
        <p className="home-card-kicker">Illustrated arrival</p>
        <p className="mt-3 text-sm">Access note</p>
        <p className="home-pin" aria-hidden="true">
          <span>4</span>
          <span>8</span>
          <span>2</span>
          <span>9</span>
          <span>1</span>
          <span>6</span>
        </p>
        <p className="mt-3 text-xs leading-relaxed text-[var(--mk-muted)]">
          Demonstration only. Onwarda does not connect to a live lock. Access notes are written for the guest, not pushed to hardware.
        </p>
      </div>
    </div>
  );
}
