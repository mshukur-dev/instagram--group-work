import { toPlace } from './locations';

describe('toPlace (Photon result → Place)', () => {
  const feature = (properties: Record<string, unknown>, coordinates: [number, number] = [2, 48]) =>
    ({ geometry: { coordinates }, properties }) as Parameters<typeof toPlace>[0];

  it('builds name, address and coordinates', () => {
    expect(
      toPlace(
        feature({
          osm_type: 'W',
          osm_id: 5013364,
          name: 'Eiffel Tower',
          city: 'Paris',
          state: 'Ile-de-France',
          country: 'France',
        }),
      ),
    ).toEqual({
      osmId: 'W5013364',
      name: 'Eiffel Tower',
      address: 'Paris, Ile-de-France, France',
      lat: 48,
      lng: 2,
    });
  });

  it('falls back to the street, skips repeated parts and needs an OSM id', () => {
    expect(
      toPlace(
        feature({
          osm_type: 'N',
          osm_id: 1,
          street: 'Main St',
          housenumber: '5',
          city: 'Oslo',
          country: 'Norway',
        }),
      )?.name,
    ).toBe('Main St 5');
    expect(
      toPlace(feature({ osm_type: 'R', osm_id: 2, name: 'Oslo', city: 'Oslo', country: 'Norway' }))
        ?.address,
    ).toBe('Norway');
    expect(toPlace(feature({ name: 'Nowhere' }))).toBeNull();
  });
});
