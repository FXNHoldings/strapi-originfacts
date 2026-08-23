import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAirline } from '@/lib/strapi';
import { getRouteFacts } from '@/lib/route-facts';
import { getAirlineFacts, getSampleFacts } from '@/lib/airline-facts';
import { getFlySfoAirlineProfile } from '@/lib/flysfo-airline';
import { getAirlineReviews } from '@/lib/airline-reviews';
import { getAirlineRef } from '@/lib/airline-refs';
import { SITE_URL, faqJsonLd } from '@/lib/entity-seo';
import { JsonLd } from '@/components/SeoBlocks';
import AirlineTier1, { derivedFaqs } from '@/components/airline-tier1/AirlineTier1';

/**
 * Preview harness for the Tier 1 airline template.
 *
 * Separate from /airlines/[slug] on purpose: the live route keeps its current
 * layout until this one is signed off, so the two can be compared side by side
 * on the same data.
 *
 * Always noindex — `?sample=1` renders the design mock's own placeholder
 * figures, which are NOT verified and must never reach the index. noindex is
 * used rather than a robots disallow because a disallowed path is never
 * crawled, so the directive on the page would never be read.
 */
export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sample?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const airline = await getAirline(slug);
  return {
    title: airline ? `${airline.name} — Tier 1 template preview` : 'Preview',
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE_URL}/airlines/${slug}` },
  };
}

const SAMPLE_NOTICE =
  'Sample mode — the figures in the published modules below come from the design mock, not from a verified source. ' +
  'They are here to show the layout only. This page is noindex and is never linked from the site.';

export default async function AirlineTier1Preview({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sample } = await searchParams;
  const airline = await getAirline(slug);
  if (!airline) notFound();

  const useSample = sample === '1';
  const alliance = await getFlySfoAirlineProfile(airline)
    .then((p) => p?.alliance ?? null)
    .catch(() => null);

  const routeFacts = getRouteFacts(airline.iataCode);
  const reviews = getAirlineReviews(airline.slug);
  const airlineRef = getAirlineRef(airline.iataCode);

  // Real facts always win. Sample content only fills in when the flag is set
  // AND no real file exists, so a genuine file can never be shadowed by a mock.
  const real = getAirlineFacts(airline.slug);
  const facts = real ?? (useSample ? getSampleFacts(airline.slug) : null);
  const showingSample = !real && useSample && Boolean(facts);

  const url = `${SITE_URL}/airlines/${airline.slug}`;
  const faqs = derivedFaqs(airline, routeFacts, alliance);

  const airlineLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Airline',
    '@id': `${url}#airline`,
    name: airline.name,
    url,
  };
  if (airline.iataCode) airlineLd.iataCode = airline.iataCode;
  if (airline.legalName) airlineLd.legalName = airline.legalName;
  if (airline.country) airlineLd.areaServed = airline.country;
  if (airline.founded) airlineLd.foundingDate = String(airline.founded);
  if (alliance) airlineLd.memberOf = { '@type': 'Organization', name: alliance };
  if (airline.website) {
    airlineLd.sameAs = airline.website.startsWith('http') ? airline.website : `https://${airline.website}`;
  }

  return (
    <>
      {/* Schema is emitted on the preview so the markup can be validated, but
          the page stays noindex — nothing here is eligible for a rich result. */}
      <JsonLd data={airlineLd} />
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <AirlineTier1
        airline={airline}
        routeFacts={routeFacts}
        facts={facts}
        alliance={alliance}
        reviews={reviews}
        airlineRef={airlineRef}
        sampleNotice={showingSample ? SAMPLE_NOTICE : null}
      />
    </>
  );
}
