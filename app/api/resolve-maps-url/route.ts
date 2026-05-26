import { NextRequest, NextResponse } from "next/server";

// Extracts coordinates from a Google Maps URL string.
// Tries multiple patterns in order of precision:
//   1. !3d{lat}!4d{lng}  — exact place coordinates embedded in the data param
//   2. @{lat},{lng}       — viewport center (less precise but always present)
//   3. ?q={lat},{lng}     — query coordinates
//   4. ?ll={lat},{lng}    — legacy format
function extractCoords(raw: string): { lat: number; lng: number } | null {
  const url = decodeURIComponent(raw);

  // Most precise: exact place location embedded in data parameter
  const placeMatch = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (placeMatch) return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };

  // Viewport center: /@lat,lng,zoom
  const atMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  // Query param: ?q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  // Legacy: ?ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    // 1. Try direct parse — no network call needed for full URLs
    const direct = extractCoords(url);
    if (direct) return NextResponse.json(direct);

    // 2. HEAD with redirect:manual — reads the Location header without downloading the page.
    //    maps.app.goo.gl always does a single 301 whose Location already contains /@lat,lng
    const headRes = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LakouBot/1.0)" },
    });

    const location = headRes.headers.get("location");
    if (location) {
      const coords = extractCoords(location);
      if (coords) return NextResponse.json({ ...coords, resolvedUrl: location });
    }

    // 3. GET fallback: follow all redirects, check res.url
    const getRes = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LakouBot/1.0)" },
    });

    const finalUrl = getRes.url;
    const coordsFromUrl = extractCoords(finalUrl);
    if (coordsFromUrl) return NextResponse.json({ ...coordsFromUrl, resolvedUrl: finalUrl });

    return NextResponse.json(
      { error: "Coordonnées introuvables. Copiez un lien depuis Google Maps → Partager." },
      { status: 422 }
    );
  } catch {
    return NextResponse.json({ error: "Erreur réseau lors de la résolution de l'URL." }, { status: 500 });
  }
}
