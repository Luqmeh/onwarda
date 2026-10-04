import { redirect } from "next/navigation";

import { MARKETING_ROUTES } from "@/config/marketing";

export default function FeaturesRedirectPage() {
  redirect(MARKETING_ROUTES.product);
}
