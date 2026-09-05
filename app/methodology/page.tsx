import { marked } from 'marked';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { readPageMarkdown } from '@/lib/pages';
import { clampDescription } from '@/lib/seo';
import { JsonLd } from '@/components/SeoBlocks';
import OutboundCitations from '@/components/OutboundCitations';
import TableOfContents from '@/components/TableOfContents';
import { injectHeadingIdsAndExtractToc } from '@/lib/toc';
import { ORG_ID, organizationJsonLd, absoluteUrl, breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Editorial Methodology & Standards | Originfacts',
  description: clampDescription(
    'Discover how Originfacts researches, verifies, and publishes travel guides, flight analysis, and destination facts with strict human editorial oversight and transparency.',
  ),
  alternates: { canonical: '/methodology' },
};

const methodologyPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Editorial Methodology & Standards | Originfacts',
  url: absoluteUrl('/methodology'),
  description:
    'Discover how Originfacts researches, verifies, and publishes travel guides, flight analysis, and destination facts with strict human editorial oversight and transparency.',
  mainEntity: { '@id': ORG_ID },
};

export default async function MethodologyPage() {
  const md = await readPageMarkdown('methodology');
  if (!md) notFound();

  const rawHtml = await marked.parse(md, { async: true });
  const { html: processedHtml, toc } = injectHeadingIdsAndExtractToc(rawHtml);

  return (
    <article className="mx-auto max-w-7xl px-6 py-16" data-testid="methodology-page">
      <JsonLd data={organizationJsonLd({ withContactPoint: true })} />
      <JsonLd data={methodologyPageJsonLd} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Methodology', url: '/methodology' }])} />
      <header className="max-w-3xl">
        <p className="chip">Methodology</p>
        <h1 className="editorial-h mt-5 text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">
          Editorial Methodology &amp; Standards
        </h1>
        <p className="mt-3 text-lg font-light text-forest-900/75">
          Originfacts maintains high content accuracy by cross-referencing all travel statistics, airport operational details, and airline baggage policies directly against official civil aviation authorities and carrier documentation. Every published article undergoes rigorous multi-tier verification by named travel domain experts to eliminate outdated information, ensure full pricing transparency, and guarantee absolute editorial independence.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-forest-900/10 bg-forest-50/60 p-5 text-sm text-forest-900">
        <span className="font-semibold">Trust &amp; Contact Channels:</span>
        <a href="mailto:contact@originfacts.com" className="font-bold underline hover:text-forest-700">
          contact@originfacts.com
        </a>
        <span className="text-forest-900/40">•</span>
        <Link href="/about" className="underline hover:text-forest-700">
          About Originfacts
        </Link>
        <span className="text-forest-900/40">•</span>
        <Link href="/contact" className="underline hover:text-forest-700">
          Contact Form
        </Link>
      </div>

      <TableOfContents items={toc} />

      <div
        className="prose-article mt-10 max-w-none"
        data-testid="methodology-body"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      <OutboundCitations title="Primary Regulatory Bodies & Operational Standards" />
    </article>
  );
}
