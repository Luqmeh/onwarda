export function onwardaContactEmail() {
  const value = process.env.ONWARDA_CONTACT_EMAIL?.trim();
  return value && value.includes("@") ? value : null;
}

export function onwardaWhatsappUrl() {
  const value = process.env.ONWARDA_WHATSAPP_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
