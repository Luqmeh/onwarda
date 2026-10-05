import type { Metadata } from "next";

import { APP_NAME } from "@/config/app";
import { ONWARDA_TAGLINE } from "@/config/brand";
import { buildAppUrl, getAppUrl } from "@/lib/url";

export function marketingSiteUrl(path = "/") {
  return buildAppUrl(getAppUrl(), path);
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
