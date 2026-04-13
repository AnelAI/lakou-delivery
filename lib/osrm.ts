/**
 * OSRM (Open Source Routing Machine) — public API, no key required.
 * Données : OpenStreetMap. Limite : usage raisonnable (< 1 req/s).
 */
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/**
 * Calcule un itinéraire routier réel entre plusieurs points.
 * @param waypoints Tableau de [lat, lng] (minimum 2 points)
 * @returns Tableau de [lat, lng] représentant le tracé sur les routes, ou null si erreur
 */
export async function getOsrmRoute(
  waypoints: [number, number][]
): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null;

  // OSRM attend les coordonnées en ordre lng,lat
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");

  try {
    const res = await fetch(
      `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    // Convertir de GeoJSON [lng, lat] vers Leaflet [lat, lng]
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
    );
  } catch {
    return null;
  }
}
