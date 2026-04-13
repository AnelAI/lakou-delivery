// Haversine formula to calculate distance between two coordinates in km
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Estimate travel time in minutes (assuming average speed of 30 km/h in city)
export function estimateTravelTime(distanceKm: number): number {
  const avgSpeedKmh = 30;
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

// Nearest-neighbor TSP algorithm to optimize delivery order
export function optimizeRoute(
  startLat: number,
  startLng: number,
  deliveries: Array<{
    id: string;
    pickupLat: number;
    pickupLng: number;
    deliveryLat: number;
    deliveryLng: number;
  }>
): string[] {
  if (deliveries.length === 0) return [];

  const remaining = [...deliveries];
  const ordered: string[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (remaining.length > 0) {
    let minDistance = Infinity;
    let closestIndex = 0;

    remaining.forEach((delivery, index) => {
      const dist = haversineDistance(
        currentLat,
        currentLng,
        delivery.pickupLat,
        delivery.pickupLng
      );
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = index;
      }
    });

    const chosen = remaining[closestIndex];
    ordered.push(chosen.id);
    currentLat = chosen.deliveryLat;
    currentLng = chosen.deliveryLng;
    remaining.splice(closestIndex, 1);
  }

  return ordered;
}

// Detect if a courier has deviated from their assigned route
// Returns true if the deviation is more than thresholdKm
export function isRouteDeviation(
  courierLat: number,
  courierLng: number,
  routePoints: Array<{ lat: number; lng: number }>,
  thresholdKm: number = 0.3
): boolean {
  if (routePoints.length === 0) return false;

  // Find minimum distance from courier to any route segment
  let minDist = Infinity;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const dist = distanceToSegment(
      courierLat,
      courierLng,
      routePoints[i].lat,
      routePoints[i].lng,
      routePoints[i + 1].lat,
      routePoints[i + 1].lng
    );
    if (dist < minDist) minDist = dist;
  }

  // Also check distance to each point
  for (const point of routePoints) {
    const dist = haversineDistance(courierLat, courierLng, point.lat, point.lng);
    if (dist < minDist) minDist = dist;
  }

  return minDist > thresholdKm;
}

// Distance from point (px, py) to segment (ax, ay)-(bx, by)
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return haversineDistance(px, py, ax, ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const nearestX = ax + t * dx;
  const nearestY = ay + t * dy;

  return haversineDistance(px, py, nearestX, nearestY);
}

// Generate a simple straight-line route between two points (for demo)
export function generateSimpleRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  steps: number = 10
): Array<{ lat: number; lng: number }> {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: fromLat + (toLat - fromLat) * t,
      lng: fromLng + (toLng - fromLng) * t,
    });
  }
  return points;
}
