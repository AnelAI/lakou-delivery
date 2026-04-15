/**
 * OSRM (Open Source Routing Machine) — public API, no key required.
 * Données : OpenStreetMap. Limite : usage raisonnable (< 1 req/s).
 */
const OSRM_BASE = "https://router.project-osrm.org";

/**
 * Calcule un itinéraire routier réel entre plusieurs points.
 * @param waypoints Tableau de [lat, lng] (minimum 2 points)
 * @returns Tableau de [lat, lng] représentant le tracé sur les routes, ou null si erreur
 */
export async function getOsrmRoute(
  waypoints: [number, number][]
): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null;

  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");

  try {
    const res = await fetch(
      `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
    );
  } catch {
    return null;
  }
}

export interface TripResult {
  /** Full route polyline (lat, lng) in optimal order */
  geometry: [number, number][];
  /** Optimal visit order for the intermediate stops (0-based indices into the original `stops` array) */
  stopOrder: number[];
  /** Total distance in meters */
  distance: number;
  /** Total duration in seconds */
  duration: number;
}

/**
 * Optimise l'ordre de visite des points intermédiaires (collectes) puis route
 * vers la destination finale.
 *
 * @param start    Position courante du coursier [lat, lng]
 * @param stops    Points de collecte intermédiaires [[lat, lng], ...]
 * @param end      Destination finale (livraison client) [lat, lng]
 *
 * OSRM Trip avec source=first, destination=last, roundtrip=false :
 * le premier et le dernier waypoint sont fixes, les intermédiaires sont réordonnés.
 */
export async function getOsrmTrip(
  start: [number, number],
  stops: [number, number][],
  end: [number, number]
): Promise<TripResult | null> {
  // Need at least start + 1 stop + end
  if (stops.length === 0) return null;

  // All waypoints: [start, ...stops, end]
  const all: [number, number][] = [start, ...stops, end];

  // OSRM expects lng,lat
  const coords = all.map(([lat, lng]) => `${lng},${lat}`).join(";");

  try {
    const url =
      `${OSRM_BASE}/trip/v1/driving/${coords}` +
      `?roundtrip=false&source=first&destination=last` +
      `&overview=full&geometries=geojson&steps=false`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return fallbackTrip(start, stops, end);

    const data = await res.json();
    if (data.code !== "Ok" || !data.trips?.[0] || !data.waypoints) {
      return fallbackTrip(start, stops, end);
    }

    const trip = data.trips[0];

    // data.waypoints[i].waypoint_index = position in the optimized trip for waypoint i
    // We need the optimized order of the intermediate stops (indices 1..stops.length)
    // waypoints is indexed by original waypoint order; waypoint_index tells where it lands in the trip.
    const stopOrder = data.waypoints
      .slice(1, 1 + stops.length)                         // only the intermediate stops
      .map((wp: { waypoint_index: number }, i: number) => ({ orig: i, tripIdx: wp.waypoint_index }))
      .sort((a: { tripIdx: number }, b: { tripIdx: number }) => a.tripIdx - b.tripIdx)
      .map((x: { orig: number }) => x.orig);

    const geometry: [number, number][] = trip.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
    );

    return {
      geometry,
      stopOrder,
      distance: trip.distance,
      duration: trip.duration,
    };
  } catch {
    return fallbackTrip(start, stops, end);
  }
}

/** Straight-line fallback when OSRM is unavailable */
function fallbackTrip(
  start: [number, number],
  stops: [number, number][],
  end: [number, number]
): TripResult {
  // Nearest-neighbour heuristic on straight-line distances
  const remaining = stops.map((s, i) => ({ i, s }));
  const order: number[] = [];
  let current = start;

  while (remaining.length > 0) {
    let best = 0;
    let bestDist = Infinity;
    for (let j = 0; j < remaining.length; j++) {
      const d = haversine(current, remaining[j].s);
      if (d < bestDist) { bestDist = d; best = j; }
    }
    order.push(remaining[best].i);
    current = remaining[best].s;
    remaining.splice(best, 1);
  }

  const ordered: [number, number][] = [start, ...order.map((i) => stops[i]), end];
  return {
    geometry: ordered,
    stopOrder: order,
    distance: 0,
    duration: 0,
  };
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
