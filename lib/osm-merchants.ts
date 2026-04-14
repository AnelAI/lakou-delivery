/**
 * OpenStreetMap — Overpass API
 * Fetch businesses around Bizerte and map them to our category system.
 * Public API, free, no key required. Usage: reasonable rate (< 1 req/s).
 */

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const BIZERTE_LAT  = 37.2744;
const BIZERTE_LNG  = 9.8739;
const RADIUS_M     = 20000; // 20 km

// ── OSM tag → app category ────────────────────────────────────────────────
const AMENITY_MAP: Record<string, string> = {
  restaurant: "restaurant",
  fast_food:  "restaurant",
  cafe:       "restaurant",
  pharmacy:   "pharmacie",
};

const SHOP_MAP: Record<string, string> = {
  bakery:        "patisserie",
  pastry:        "patisserie",
  confectionery: "patisserie",
  butcher:       "boucherie",
  poultry:       "volaillerie",
  cheese:        "fromagerie",
  dairy:         "fromagerie",
  supermarket:   "supermarche",
  convenience:   "supermarche",
  grocery:       "supermarche",
  mini_supermarket: "supermarche",
  water:         "eau",
  beverages:     "eau",
  general:       "course",
  kiosk:         "course",
};

// ── Overpass QL query ─────────────────────────────────────────────────────
function buildQuery(): string {
  const amenities = Object.keys(AMENITY_MAP).join("|");
  const shops     = Object.keys(SHOP_MAP).join("|");
  const around    = `around:${RADIUS_M},${BIZERTE_LAT},${BIZERTE_LNG}`;

  return `
[out:json][timeout:30];
(
  node["amenity"~"^(${amenities})$"]["name"](${around});
  way["amenity"~"^(${amenities})$"]["name"](${around});
  node["shop"~"^(${shops})$"]["name"](${around});
  way["shop"~"^(${shops})$"]["name"](${around});
);
out center body;
  `.trim();
}

export interface OsmMerchant {
  osmId:    string;
  name:     string;
  category: string;
  address:  string | null;
  lat:      number;
  lng:      number;
  phone:    string | null;
  website:  string | null;
}

// ── Parse a single OSM element ────────────────────────────────────────────
function parseElement(el: Record<string, unknown>): OsmMerchant | null {
  const tags = (el.tags ?? {}) as Record<string, string>;

  // Require a name
  const name = tags["name"] || tags["name:fr"] || tags["name:ar"];
  if (!name) return null;

  // Map category
  const amenity = tags["amenity"];
  const shop    = tags["shop"];
  const category =
    (amenity && AMENITY_MAP[amenity]) ||
    (shop    && SHOP_MAP[shop])       ||
    null;
  if (!category) return null;

  // Coordinates: node → lat/lng directly, way → center
  let lat: number, lng: number;
  if (el.type === "node") {
    lat = el.lat as number;
    lng = el.lon as number;
  } else if (el.type === "way" && el.center) {
    const c = el.center as Record<string, number>;
    lat = c.lat;
    lng = c.lon;
  } else {
    return null;
  }

  // Build address from OSM addr:* tags
  const addressParts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : (tags["description"] || null);

  const phone   = tags["phone"] || tags["contact:phone"] || null;
  const website = tags["website"] || tags["contact:website"] || null;

  return {
    osmId:    `${el.type}/${el.id}`,
    name:     name.trim(),
    category,
    address,
    lat,
    lng,
    phone:   phone   ? phone.trim()   : null,
    website: website ? website.trim() : null,
  };
}

// ── Public fetch function ─────────────────────────────────────────────────
export async function fetchOsmMerchants(): Promise<OsmMerchant[]> {
  const body = buildQuery();

  const res = await fetch(OVERPASS_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(body)}`,
    signal: AbortSignal.timeout(35000),
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

  const json = await res.json() as { elements: Record<string, unknown>[] };

  const results: OsmMerchant[] = [];
  for (const el of json.elements) {
    const m = parseElement(el);
    if (m) results.push(m);
  }

  return results;
}
