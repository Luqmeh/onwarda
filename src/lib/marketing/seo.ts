import type { Metadata } from "next";

import { APP_NAME, DEFAULT_APP_URL } from "@/config/app";
import { ONWARDA_TAGLINE } from "@/config/brand";
import { getPublicEnv } from "@/config/env";

export function marketingSiteUrl(path = "/") {
  try {
    return new URL(path, getPublicEnv().NEXT_PUBLIC_APP_URL).toString();
  } catch {
    return new URL(path, DEFAULT_APP_URL).toString();
  }
}

export function marketingMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = marketingSiteUrl(input.path);

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${input.title} · ${APP_NAME}`,
      description: input.description,
      url,
      siteName: APP_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${input.title} · ${APP_NAME}`,
      description: input.description,
    },
  };
}

export function marketingJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Onwarda is an operating layer for hospitality: property presentation, a guided guest journey, and operator visibility in one platform.",
    slogan: ONWARDA_TAGLINE,
    offers: {
      "@type": "Offer",
      priceCurrency: "MAD",
      availability: "https://schema.org/PreOrder",
    },
  };
}
