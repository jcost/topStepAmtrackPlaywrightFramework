/**
 * Canned `AutoCompleterArcgis/getResponseList` station entries, captured verbatim from
 * the live site with the Playwright MCP on 2026-08-28. Used by the deterministic mock
 * lane (see `amtrak-routes.ts`) so the suite doesn't depend on the live autocomplete's
 * latency. Re-capture if the live payload shape changes — the `live-chromium` project
 * is what catches that.
 */

export interface StationEntry {
  displayName: string;
  autoFillName: string;
  name: string;
  stationName: string;
  stationFacilityName: string;
  stationCode: string;
  stationAliases: string;
  city: string;
  state: string;
  address1: string;
  address2: string;
  postalCode: string;
  geometry: { lat: number; lng: number };
  matchType: string;
  resultType: 'Station';
  stationRank: string;
}

export const STATION_CATALOG: StationEntry[] = [
  {
    address1: '351 West 31st Street',
    address2: '',
    autoFillName: 'New York, NY - Moynihan Train Hall at Penn Sta. (NYP)',
    city: 'New York',
    displayName: 'New York, NY - Moynihan Train Hall at Penn Sta. (NYP)',
    geometry: { lat: 40.75103800022871, lng: -73.99632699972983 },
    matchType: 'name',
    name: 'New York, NY',
    postalCode: '10001',
    resultType: 'Station',
    state: 'NY',
    stationAliases: 'nyc,Penn Station,Moynihan Train Hall,new york city,newyork',
    stationCode: 'NYP',
    stationFacilityName: 'Moynihan Train Hall at Penn Sta.',
    stationName: 'New York, NY',
    stationRank: '1',
  },
  {
    address1: '50 Massachusetts Avenue NE',
    address2: '',
    autoFillName: 'Washington, DC - Union Station (WAS)',
    city: 'Washington',
    displayName: 'Washington, DC - Union Station (WAS)',
    geometry: { lat: 38.8969930004283, lng: -77.00642200035293 },
    matchType: 'name',
    name: 'Washington, DC',
    postalCode: '20002-4214',
    resultType: 'Station',
    state: 'DC',
    stationAliases: 'Union Station',
    stationCode: 'WAS',
    stationFacilityName: 'Union Station',
    stationName: 'Washington, DC',
    stationRank: '',
  },
  {
    address1: '2 South Station',
    address2: '',
    autoFillName: 'Boston, MA - South Station (BOS)',
    city: 'Boston',
    displayName: 'Boston, MA - South Station (BOS)',
    geometry: { lat: 42.35231100002185, lng: -71.0553040001058 },
    matchType: 'name',
    name: 'Boston, MA',
    postalCode: '02110',
    resultType: 'Station',
    state: 'MA',
    stationAliases: 'South Station',
    stationCode: 'BOS',
    stationFacilityName: 'South Station',
    stationName: 'Boston, MA',
    stationRank: '1',
  },
  {
    address1: '2955 Market Street',
    address2: '',
    autoFillName: 'Philadelphia, PA - William H Gray III 30th St. Sta. (PHL)',
    city: 'Philadelphia',
    displayName: 'Philadelphia, PA - William H Gray III 30th St. Sta. (PHL)',
    geometry: { lat: 39.95561500024275, lng: -75.1810409996677 },
    matchType: 'name',
    name: 'Philadelphia, PA',
    postalCode: '19104',
    resultType: 'Station',
    state: 'PA',
    stationAliases: '30th,Gray,Grey',
    stationCode: 'PHL',
    stationFacilityName: 'William H Gray III 30th St. Sta.',
    stationName: 'Philadelphia, PA',
    stationRank: '',
  },
];

/** A non-station ("Locations") result — carries no `(XXX)` code, so the "no real
 *  station for gibberish" test sees zero real suggestions. */
export const LOCATION_RESULT = (name: string): Record<string, string> => ({
  displayName: name,
  fullAddress: name,
  magicKey: 'mock',
  matchType: '',
  name,
  resultType: 'Locations',
});
