import type { Prisma } from '@prisma/client';
import type { Place, PlaceInput } from '@instagram/shared';
import { serviceUnavailable } from '../../common/errors/app-exception';

// Location search goes through Photon (OpenStreetMap data, free, no key):
// https://photon.komoot.io — called from the API so the browser talks only to us.
const PHOTON_URL = 'https://photon.komoot.io/api/';
const SEARCH_LIMIT = 8;
const SEARCH_TIMEOUT_MS = 5000;

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

/** "Big Ben" + "London, England, United Kingdom" out of a Photon result */
export function toPlace(feature: PhotonFeature): Place | null {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = p.name ?? (street || p.city);
  if (!p.osm_type || p.osm_id === undefined || !name) return null;
  const address = [street !== name ? street : null, p.city, p.state, p.country]
    .filter((part): part is string => Boolean(part) && part !== name)
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(', ');
  return { osmId: `${p.osm_type}${p.osm_id}`, name, address: address || null, lat, lng };
}

/** `english`: English names where OSM has them (Photon has no Russian; then local names) */
export async function searchPlaces(q: string, english: boolean): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: String(SEARCH_LIMIT) });
  if (english) params.set('lang', 'en');
  const url = `${PHOTON_URL}?${params}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'instagram-student-project' },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
  } catch {
    throw serviceUnavailable('Location search is not available right now.');
  }
  if (!response.ok) throw serviceUnavailable('Location search is not available right now.');
  const body = (await response.json()) as { features?: PhotonFeature[] };
  const places = (body.features ?? []).flatMap((f) => toPlace(f) ?? []);
  // The same place can come twice (a node and a way, two halves of a bridge); keep the first
  const key = (p: Place) => `${p.name}|${p.address ?? ''}`;
  return places.filter(
    (p, i) => places.findIndex((o) => o.osmId === p.osmId || key(o) === key(p)) === i,
  );
}

/** The place's row (created on its first post) — inside the post's transaction */
export async function upsertLocation(
  tx: Prisma.TransactionClient,
  place: PlaceInput,
): Promise<string> {
  const data = {
    name: place.name,
    address: place.address ?? null,
    lat: place.lat,
    lng: place.lng,
  };
  const row = await tx.location.upsert({
    where: { osmId: place.osmId },
    create: { osmId: place.osmId, ...data },
    update: data,
    select: { id: true },
  });
  return row.id;
}
