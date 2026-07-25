/**
 * Shared schema.org JSON-LD builders for section / listing hubs.
 *
 * Article pages build their Article + BreadcrumbList inline (see
 * app/articles/[slug]/page.tsx) and entity pages use the per-entity builders in
 * lib/entity-seo.ts. This module covers the generic listing shapes —
 * BreadcrumbList, ItemList and CollectionPage — so every hub emits the same
 * structure instead of hand-rolling it per route.
 *
 * Every URL these builders emit is absolute, resolved from the single SITE_URL
 * constant in lib/entity-seo.ts.
 */
import { SITE_URL } from '@/lib/entity-seo';

export type BreadcrumbItem = {
  name: string;
  /** Absolute URL or site-root-relative path ("/airports"). */
  url: string;
};

export type ListItem = {
  name: string;
  /** Absolute URL or site-root-relative path ("/airports/PER"). */
  url: string;
  image?: string | null;
  /** 1-based. Defaults to the item's index in the array. */
  position?: number;
};

/**
 * Upper bound on itemListElement entries.
 *
 * The directory hubs (airports, airlines, routes, countries) hand their full
 * dataset to a client component that filters and caps what it paints — /airports
 * alone carries 3,600+ records. Serialising all of them would add hundreds of KB
 * of JSON-LD to the HTML for no ranking benefit, so the list is truncated to a
 * representative head. Google treats a partial ItemList as valid.
 */
export const ITEM_LIST_MAX = 100;

/** Resolves a path or URL to an absolute https://www.originfacts.com/… URL. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/**
 * BreadcrumbList. Pass the trail without the site root — "Home" is prepended
 * automatically so every hub reports the same first crumb.
 */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  const trail: BreadcrumbItem[] = [{ name: 'Home', url: '/' }, ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

/**
 * ItemList of the cards a hub renders. Returns null for an empty list so callers
 * can pass the result straight to <JsonLd data={…} /> without emitting an empty
 * shell when an upstream fetch fails.
 */
export function itemListJsonLd(
  items: ListItem[],
  opts: { name?: string; url?: string; max?: number } = {},
): Record<string, unknown> | null {
  const capped = items.slice(0, opts.max ?? ITEM_LIST_MAX);
  if (capped.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    ...(opts.name ? { name: opts.name } : {}),
    ...(opts.url ? { url: absoluteUrl(opts.url) } : {}),
    numberOfItems: capped.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: capped.map((item, i) => ({
      '@type': 'ListItem',
      position: item.position ?? i + 1,
      name: item.name,
      url: absoluteUrl(item.url),
      ...(item.image ? { image: absoluteUrl(item.image) } : {}),
    })),
  };
}

/**
 * CollectionPage describing the hub itself. When `items` are supplied the
 * ItemList is nested under mainEntity, which keeps the hub to a single
 * self-describing graph node rather than two unrelated top-level objects.
 */
export function collectionPageJsonLd({
  name,
  description,
  url,
  items,
  itemListName,
  max,
}: {
  name: string;
  description: string;
  url: string;
  items?: ListItem[];
  itemListName?: string;
  max?: number;
}): Record<string, unknown> {
  const absolute = absoluteUrl(url);
  // Nested ItemLists are part of the parent node, so they must not repeat
  // @context — strip it rather than letting the builder's copy through.
  const list = items ? itemListJsonLd(items, { name: itemListName, url, max }) : null;
  if (list) delete (list as Record<string, unknown>)['@context'];

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: absolute,
    '@id': absolute,
    isPartOf: { '@type': 'WebSite', name: 'Originfacts', url: SITE_URL },
    ...(list ? { mainEntity: list } : {}),
  };
}
