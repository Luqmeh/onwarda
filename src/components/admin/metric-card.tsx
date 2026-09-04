import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: number;
  emptyLabel?: string;
  href?: string;
};

export function MetricCard({
  label,
  value,
  emptyLabel = "None",
  href,
}: MetricCardProps) {
  const card = (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {value > 0 ? (
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </CardContent>
    </Card>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} className="block rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  );
}
