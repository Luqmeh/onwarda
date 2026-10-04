import { PublicPropertyCard } from "@/components/public/property-card";
import { PublicShell, PublicUnavailable } from "@/components/public/public-shell";
import { recordPublicExperienceEvent } from "@/lib/public/events";
import { loadPublicOperatorPortfolio } from "@/lib/public/load";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Homes",
};

export default async function PublicOperatorPortfolioPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const portfolio = await loadPublicOperatorPortfolio(organizationSlug);

  if (portfolio.status !== "ok") {
    return (
      <PublicUnavailable
        title="This collection is not available"
        description="The operator page you are looking for is not public, or the address is incorrect."
      />
    );
  }

  await recordPublicExperienceEvent({
    type: "public_operator_viewed",
    organizationSlug: portfolio.organizationSlug,
  });

  return (
    <PublicShell branding={portfolio.branding} organizationSlug={portfolio.organizationSlug}>
      <section className="border-b bg-[color-mix(in_srgb,var(--client-primary)_10%,var(--client-background))]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="onwarda-kicker">Collection</p>
          <h1 className="onwarda-display mt-3 max-w-3xl">{portfolio.branding.displayName}</h1>
          {portfolio.branding.publicDescription ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-onwarda-muted">
              {portfolio.branding.publicDescription}
            </p>
          ) : (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-onwarda-muted">
              Homes prepared for guests, shown as the host presents them.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-xl font-medium tracking-tight">Homes</h2>
        {portfolio.properties.length === 0 ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-onwarda-muted">
            No homes are listed publicly yet. Please check back soon or contact the host directly.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {portfolio.properties.map((property) => (
              <PublicPropertyCard
                key={property.slug}
                organizationSlug={portfolio.organizationSlug}
                property={property}
              />
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
