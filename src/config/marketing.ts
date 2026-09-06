export const MARKETING_ROUTES = {
  home: "/",
  product: "/product",
  features: "/features",
  guestExperience: "/guest-experience",
  propertyExperience: "/property-experience",
  operations: "/operations",
  services: "/services",
  pricing: "/pricing",
  about: "/about",
  contact: "/contact",
  faq: "/faq",
  signup: "/signup",
  login: "/login",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const MARKETING_NAV = [
  { href: MARKETING_ROUTES.product, label: "Product" },
  { href: MARKETING_ROUTES.operations, label: "Solutions" },
  { href: MARKETING_ROUTES.services, label: "Services" },
  { href: MARKETING_ROUTES.pricing, label: "Pricing" },
  { href: MARKETING_ROUTES.about, label: "About" },
] as const;

export const MARKETING_FOOTER_PRODUCT = [
  { href: MARKETING_ROUTES.product, label: "Product" },
  { href: MARKETING_ROUTES.guestExperience, label: "Guest experience" },
  { href: MARKETING_ROUTES.propertyExperience, label: "Property experience" },
  { href: MARKETING_ROUTES.operations, label: "Operations" },
  { href: MARKETING_ROUTES.pricing, label: "Pricing" },
  { href: MARKETING_ROUTES.services, label: "Services" },
] as const;

export const MARKETING_FOOTER_COMPANY = [
  { href: MARKETING_ROUTES.about, label: "About" },
  { href: MARKETING_ROUTES.faq, label: "FAQ" },
  { href: MARKETING_ROUTES.contact, label: "Contact" },
  { href: MARKETING_ROUTES.login, label: "Log in" },
] as const;
