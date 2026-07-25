/**
 * Editable copy for the section / listing hubs.
 *
 * One entry per hub route. `name` and `description` feed both the App Router
 * `metadata` export and the CollectionPage JSON-LD; `intro` is the long visible
 * paragraph rendered under the <h1> (via ExpandableDescription, which keeps the
 * collapsed remainder in the DOM for crawlers).
 *
 * Keep each `intro` unique — duplicated boilerplate across hubs is precisely the
 * thin-content pattern these pages are meant to avoid. Editors can change copy
 * here without touching the route components.
 */
export type HubSlug =
  | 'destinations'
  | 'airports'
  | 'airlines'
  | 'flight-routes'
  | 'countries';

export type HubIntro = {
  /** Breadcrumb + CollectionPage name. */
  name: string;
  /** Meta description. Kept under 155 chars so it doesn't truncate in SERPs. */
  description: string;
  /** Long-form visible intro paragraph. */
  intro: string;
};

export const HUB_PATHS: Record<HubSlug, string> = {
  destinations: '/destinations',
  airports: '/airports',
  airlines: '/airlines',
  'flight-routes': '/flight-routes',
  countries: '/countries',
};

export const HUB_INTROS: Record<HubSlug, HubIntro> = {
  destinations: {
    name: 'Destinations',
    description:
      "Every place we've written about — continents, countries, and cities worth your time. Search, filter, and browse.",
    intro:
      "Every place we've reported on, gathered in one index — continents you can browse end to end, countries with enough coverage to plan a trip around, and the individual cities where we've done the walking ourselves. Each destination page pulls together our published guides alongside the practical scaffolding around them: the airports that serve the area, the airlines flying in, the routes that make the journey cheap or awkward, and the time of year the numbers actually favour. Filter by continent to see where our coverage runs deepest, or search for somewhere specific to find out what we know before you commit to the flight.",
  },
  airports: {
    name: 'Airports',
    description:
      'A searchable directory of commercial airports worldwide — IATA codes, cities, hubs, and route information.',
    intro:
      "A searchable index of every commercial airport we track — large international hubs, secondary city fields, and the regional strips that quietly stitch the long-haul network together. Each entry carries the three-letter IATA code, the four-letter ICAO identifier, the city and country it serves, latitude and longitude, time zone, and the world region it sits in. Use the filters to find an airport by code, by city name, or by country, then click through to its profile to see the airlines that fly there and the routes it operates. The directory is most useful when you're translating between codes and cities, working out whether two nearby airports actually share a metro area, or planning a self-connect — the kind of question travel-site search boxes never let you ask directly.",
  },
  airlines: {
    name: 'Airlines',
    description:
      'A searchable directory of airlines worldwide — IATA codes, hubs, and details for scheduled, low-cost, and regional carriers.',
    intro:
      "A working index of the world's commercial airlines — full-service flag carriers, low-cost operators, regional turboprops, and cargo airlines all live in the same searchable list. For each carrier we capture the legal name, IATA and ICAO codes, country of registration, primary hub airport, and founding year, so you can size up the airline behind a fare before you book. Use the filters to slice by region, country, or operator type; tap any airline to land on its profile page, which links straight to a marker-tagged search filtered by that carrier's IATA code. The directory is rebuilt nightly from our master dataset, so a new low-cost launch or a regional rebrand shows up here without us having to push code — it's designed to stay accurate as the industry shuffles rather than rot the moment it ships.",
  },
  'flight-routes': {
    name: 'Flight Routes',
    description:
      'Every route we track — searchable by origin, destination, IATA code, or country. Carriers, flight time, and booking.',
    intro:
      'Every route in our index is a city-pair — the bones of how the world actually flies. We track which carriers operate each leg, the typical block time, the great-circle distance, and the airports at either end, so you can size up a trip before you ever open a search engine. Use the filters to narrow by origin, destination, country, or IATA code; tap any route to see the airlines flying it, their hubs, and a live fare search pre-populated for the city pair. The directory is most useful when you already know roughly where you want to go and want a sober view of who flies it, how long the flight takes, and how many stops you should expect — long before you start chasing the headline price.',
  },
  countries: {
    name: 'Countries',
    description:
      'Browse countries with commercial air service — ISO codes, airport counts, cities, and regional groupings.',
    intro:
      "A directory of every country with scheduled commercial air service — built from our Travelpayouts dataset and kept current as new carriers launch, hubs shift, and second-tier airports open. Each country page gathers the airports inside its borders, the airlines registered there, the top inbound and outbound routes, and our own travel coverage (hotels, flights, car rentals, on-the-ground tips) so you can move fluidly from a destination idea to the practical bits of getting there. Filter by name or ISO-3166 code, browse by continent, or click straight through to a country profile — useful whether you're decoding a stopover, comparing visa-on-arrival rules across regions, or planning a multi-country itinerary from a single base. The index is read from one source of truth, so a country's airline list stays in sync with the rest of the site as our coverage grows.",
  },
};
