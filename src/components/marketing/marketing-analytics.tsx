"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

import { publicMarketingPath } from "@/lib/marketing/web-analytics";

function allowPublicMarketingPage(event: BeforeSendEvent): BeforeSendEvent | null {
  const path = publicMarketingPath(event.url);
  if (!path) return null;
  return event.url === path ? event : { ...event, url: path };
}

export function MarketingAnalytics() {
  return <Analytics beforeSend={allowPublicMarketingPage} />;
}
