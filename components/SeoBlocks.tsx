import type { Faq } from '@/lib/entity-seo';

/** Renders a schema.org JSON-LD object into a script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Accessible FAQ block. Real, on-page Q&A content (the visible counterpart to
 * the FAQPage JSON-LD) — adds substantive, unique text to the entity pages.
 */
export function FaqSection({
  faqs,
  title = 'Frequently asked questions',
}: {
  faqs: Faq[];
  title?: string;
}) {
  if (!faqs.length) return null;
  return (
    <section className="mx-auto mt-16 max-w-3xl px-6 pb-4" data-testid="faq">
      <p className="section-eyebrow">
        <span className="inline-block h-px w-8 bg-forest-800/60" />
        FAQ
      </p>
      <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">{title}</h2>
      <dl className="mt-6 divide-y divide-forest-900/10 border-y border-forest-900/10">
        {faqs.map((f, i) => (
          <div key={i} className="py-5">
            <dt className="font-urbanist text-base font-bold text-forest-900">{f.q}</dt>
            <dd className="mt-2 text-sm font-light leading-relaxed text-forest-900/80">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
