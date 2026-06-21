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
    <section className="mx-auto mt-16 max-w-7xl px-6 pb-4" data-testid="faq">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <div>
          <p className="section-eyebrow">
            <span className="inline-block h-px w-8 bg-forest-800/60" />
            FAQ
          </p>
          <h2 className="editorial-h mt-3 text-2xl font-bold text-forest-900 lg:text-3xl">{title}</h2>
          <p className="mt-4 max-w-md text-sm font-light leading-7 text-forest-900/78">
            Quick answers to the details travellers usually check first, from codes and locations to the practical basics that help with planning.
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-forest-900/45">
            {faqs.length} common question{faqs.length === 1 ? '' : 's'}
          </p>
        </div>

        <dl className="space-y-3 lg:pt-[4.5rem]">
          {faqs.map((f, i) => (
            <details key={i} className="group border-b border-forest-900/10 pb-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-3 font-urbanist text-base font-bold leading-snug text-forest-900 marker:content-none">
                <span>{f.q}</span>
                <span className="mt-0.5 text-lg font-light text-forest-900/45 transition group-open:rotate-45">+</span>
              </summary>
              <dd className="pr-8 text-sm font-light leading-7 text-forest-900/78">{f.a}</dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}
