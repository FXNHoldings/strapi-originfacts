import type { Metadata } from 'next';
import manifest from '@/data/proposals/review-manifest.json';
import styles from './review.module.css';

export const metadata: Metadata = {
  title: 'Airline fact proposal review',
  robots: { index: false, follow: false, nocache: true },
};

type Operation = {
  module: string;
  field: string;
  value: string;
  confidence: number;
  confidence_band: string;
  status: string;
  flags: string[];
  evidence: string;
  source_url: string;
};

const moduleTitle: Record<string, string> = {
  carryon: 'Carry-on',
  baggage: 'Checked baggage',
  checkin: 'Check-in and airport cutoffs',
  fares: 'Fares',
  rights: 'Passenger rights',
};

function airlineName(slug: string) {
  return slug.split('-').map((word) => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

export default function AirlineFactsReviewPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Preview only · noindex</p>
        <h1>Airline fact proposal review</h1>
        <p>
          All proposed facts are unreviewed and cannot be published from this page.
          Open an airline, then a content section, to inspect its evidence.
        </p>
      </header>

      <div className={styles.airlines}>
        {manifest.carriers.map((carrier) => {
          const operations = carrier.operations as Operation[];
          const modules = [...new Set(operations.map((item) => item.module))];
          const summary = carrier.summary;
          return (
            <details className={styles.airline} key={carrier.carrier_key}>
              <summary>
                <strong>{airlineName(carrier.carrier_key)}</strong>
                <span>
                  {summary.field_proposals} proposals · {summary.high_confidence} high confidence ·{' '}
                  {summary.needs_review} need review
                </span>
              </summary>
              <div className={styles.airlineBody}>
                {modules.length === 0 && <p>No field proposals from the available evidence.</p>}
                {modules.map((module) => {
                  const rows = operations.filter((item) => item.module === module);
                  return (
                    <details className={styles.module} key={module}>
                      <summary>
                        <strong>{moduleTitle[module] ?? module}</strong>
                        <span>{rows.length} proposal{rows.length === 1 ? '' : 's'}</span>
                      </summary>
                      <div className={styles.tableWrap}>
                        <table>
                          <thead><tr><th>Field</th><th>Value</th><th>Confidence</th><th>Status</th><th>Flags</th><th>Evidence</th><th>Source</th></tr></thead>
                          <tbody>
                            {rows.map((item, index) => (
                              <tr className={item.status === 'needs_review' ? styles.needsReview : undefined} key={`${item.field}-${index}`}>
                                <td>{item.field}</td><td>{item.value}</td>
                                <td>{item.confidence} ({item.confidence_band})</td><td>{item.status}</td>
                                <td>{item.flags.join(', ') || '—'}</td><td>{item.evidence}</td>
                                <td><a href={item.source_url} target="_blank" rel="noreferrer">Official page</a></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}
