import { marketingSiteUrl } from "@/lib/marketing/seo";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/app", "/o/", "/g/", "/login"],
    },
    sitemap: marketingSiteUrl("/sitemap.xml"),
  };
}
