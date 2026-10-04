import { MARKETING_ROUTES } from "@/config/marketing";
import { marketingSiteUrl } from "@/lib/marketing/seo";

export default function sitemap() {
  const routes = Object.values(MARKETING_ROUTES);

  return routes.map((path) => ({
    url: marketingSiteUrl(path),
    changeFrequency: path === "/" || path === "/pricing" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/pricing" || path === "/product" ? 0.8 : 0.6,
  }));
}
