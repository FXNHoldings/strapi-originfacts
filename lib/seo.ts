/**
 * Meta-tag hygiene helpers.
 *
 * clampDescription() keeps <meta name="description"> within SERP-safe length:
 * Google truncates around 155-160 chars, so anything longer gets cut
 * mid-sentence in results. Sources that produce long copy (Strapi
 * seoDescription/excerpt, entity `about` text, authored page constants) run
 * through this at the generateMetadata()/metadata layer.
 *
 * warnIfLong() logs oversized source copy at build/render time so editors get
 * feedback without titles being hard-truncated.
 */

export const DESCRIPTION_MAX = 155;
const TITLE_WARN = 60;
const DESCRIPTION_WARN = 160;

/**
 * Trims + collapses whitespace, cuts at the last word boundary before `max`,
 * and appends an ellipsis only when something was actually removed. Never
 * cuts mid-word. Empty/undefined input returns ''.
 */
export function clampDescription(input?: string | null, max = DESCRIPTION_MAX): string {
  const clean = (input ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  // Reserve one char for the ellipsis, then back off to a word boundary.
  const slice = clean.slice(0, max - 1);
  const cut = slice.lastIndexOf(' ');
  return `${(cut > 0 ? slice.slice(0, cut) : slice).replace(/[,;:.\s]+$/, '')}…`;
}

/**
 * Logs a console warning when source copy exceeds SERP-safe lengths — shows up
 * in `yarn build` output (static pages) and server logs (dynamic ones).
 * Returns the inputs untouched: feedback for editors, never a hard truncation
 * of titles.
 */
export function warnIfLong(url: string, opts: { title?: string | null; description?: string | null }): void {
  const title = opts.title?.trim();
  const description = opts.description?.trim();
  if (title && title.length > TITLE_WARN) {
    console.warn(`[seo] ${url}: title is ${title.length} chars (> ${TITLE_WARN}): "${title.slice(0, 80)}"`);
  }
  if (description && description.length > DESCRIPTION_WARN) {
    console.warn(
      `[seo] ${url}: description is ${description.length} chars (> ${DESCRIPTION_WARN}) — will truncate in SERPs`,
    );
  }
}
