import type { ReactNode } from "react";

import { MarketingShell } from "@/components/marketing/marketing-shell";

export const dynamic = "force-dynamic";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
