export function guestDisplayName(
  guest: { first_name?: string | null; last_name?: string | null } | null,
) {
  const name = [guest?.first_name, guest?.last_name].filter(Boolean).join(" ").trim();
  return name || "Guest";
}

export function humanizeToken(value: string) {
  return value.replace(/_/g, " ");
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatStay(checkIn: string, checkOut: string) {
  return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;
}

export function propertyLocation(property: {
  city?: string | null;
  country?: string | null;
}) {
  return [property.city, property.country].filter(Boolean).join(", ") || null;
}

export function reservationStatusLabel(status: string) {
  if (status === "active") {
    return "In stay";
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
