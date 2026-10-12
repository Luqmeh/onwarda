export function guestDisplayName(
  guest: { first_name?: string | null; last_name?: string | null } | null,
  fallback = "Guest",
) {
  const name = [guest?.first_name, guest?.last_name].filter(Boolean).join(" ").trim();
  return name || fallback;
}

export function humanizeToken(value: string) {
  return value.replace(/_/g, " ");
}

export function labeledStatus(status: string, labels: object) {
  const record = labels as Record<string, string>;
  return Object.prototype.hasOwnProperty.call(record, status) ? record[status] : humanizeToken(status);
}

export function formatDate(value: string, locale?: string) {
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    calendar: "gregory",
  });
}

export function formatStay(checkIn: string, checkOut: string, locale?: string) {
  return `${formatDate(checkIn, locale)} – ${formatDate(checkOut, locale)}`;
}

export function formatDateTime(value: string, locale?: string) {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    calendar: "gregory",
  });
}

export function propertyLocation(property: {
  city?: string | null;
  country?: string | null;
}) {
  return [property.city, property.country].filter(Boolean).join(", ") || null;
}

export function reservationStatusLabel(
  status: string,
  labels?: { active: string },
) {
  if (status === "active") {
    return labels?.active ?? "In stay";
  }

  return humanizeToken(status);
}

export function statusTone(status: string) {
  if (["active", "upcoming", "published", "resolved"].includes(status)) {
    return "olive" as const;
  }

  if (["open", "in_progress", "high", "urgent"].includes(status)) {
    return "coral" as const;
  }

  if (["complete", "completed", "low"].includes(status)) {
    return "sage" as const;
  }

  return "neutral" as const;
}
