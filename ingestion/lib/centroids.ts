// Approximate centroids for placing region markers when a source lacks site lat/lon
// (CDC NWSS and Canada do). Keyed by country + admin1 (US state abbrev, CA province
// code/name). NZ region centroids are computed from the data's own site coordinates.

export interface Centroid {
  country: string;
  admin1: string;
  lat: number;
  lon: number;
}

export const STATIC_CENTROIDS: Centroid[] = [
  // United States (state abbreviations as used by CDC wwtp_jurisdiction)
  { country: "US", admin1: "AL", lat: 32.8, lon: -86.8 },
  { country: "US", admin1: "AK", lat: 64.2, lon: -149.5 },
  { country: "US", admin1: "AZ", lat: 34.3, lon: -111.7 },
  { country: "US", admin1: "AR", lat: 34.9, lon: -92.4 },
  { country: "US", admin1: "CA", lat: 37.2, lon: -119.4 },
  { country: "US", admin1: "CO", lat: 39.0, lon: -105.5 },
  { country: "US", admin1: "CT", lat: 41.6, lon: -72.7 },
  { country: "US", admin1: "DE", lat: 39.0, lon: -75.5 },
  { country: "US", admin1: "DC", lat: 38.9, lon: -77.0 },
  { country: "US", admin1: "FL", lat: 28.6, lon: -82.4 },
  { country: "US", admin1: "GA", lat: 32.6, lon: -83.4 },
  { country: "US", admin1: "HI", lat: 20.3, lon: -156.4 },
  { country: "US", admin1: "ID", lat: 44.4, lon: -114.6 },
  { country: "US", admin1: "IL", lat: 40.0, lon: -89.2 },
  { country: "US", admin1: "IN", lat: 39.9, lon: -86.3 },
  { country: "US", admin1: "IA", lat: 42.0, lon: -93.5 },
  { country: "US", admin1: "KS", lat: 38.5, lon: -98.4 },
  { country: "US", admin1: "KY", lat: 37.5, lon: -85.3 },
  { country: "US", admin1: "LA", lat: 31.0, lon: -92.0 },
  { country: "US", admin1: "ME", lat: 45.4, lon: -69.2 },
  { country: "US", admin1: "MD", lat: 39.0, lon: -76.8 },
  { country: "US", admin1: "MA", lat: 42.3, lon: -71.8 },
  { country: "US", admin1: "MI", lat: 44.3, lon: -85.4 },
  { country: "US", admin1: "MN", lat: 46.3, lon: -94.3 },
  { country: "US", admin1: "MS", lat: 32.7, lon: -89.7 },
  { country: "US", admin1: "MO", lat: 38.4, lon: -92.5 },
  { country: "US", admin1: "MT", lat: 47.0, lon: -109.6 },
  { country: "US", admin1: "NE", lat: 41.5, lon: -99.8 },
  { country: "US", admin1: "NV", lat: 39.3, lon: -116.6 },
  { country: "US", admin1: "NH", lat: 43.7, lon: -71.6 },
  { country: "US", admin1: "NJ", lat: 40.1, lon: -74.7 },
  { country: "US", admin1: "NM", lat: 34.4, lon: -106.1 },
  { country: "US", admin1: "NY", lat: 42.9, lon: -75.5 },
  { country: "US", admin1: "NC", lat: 35.6, lon: -79.4 },
  { country: "US", admin1: "ND", lat: 47.5, lon: -100.5 },
  { country: "US", admin1: "OH", lat: 40.3, lon: -82.8 },
  { country: "US", admin1: "OK", lat: 35.6, lon: -97.5 },
  { country: "US", admin1: "OR", lat: 44.0, lon: -120.6 },
  { country: "US", admin1: "PA", lat: 40.9, lon: -77.8 },
  { country: "US", admin1: "RI", lat: 41.7, lon: -71.6 },
  { country: "US", admin1: "SC", lat: 33.9, lon: -80.9 },
  { country: "US", admin1: "SD", lat: 44.4, lon: -100.2 },
  { country: "US", admin1: "TN", lat: 35.9, lon: -86.4 },
  { country: "US", admin1: "TX", lat: 31.5, lon: -99.3 },
  { country: "US", admin1: "UT", lat: 39.3, lon: -111.7 },
  { country: "US", admin1: "VT", lat: 44.1, lon: -72.7 },
  { country: "US", admin1: "VA", lat: 37.5, lon: -78.9 },
  { country: "US", admin1: "WA", lat: 47.4, lon: -120.5 },
  { country: "US", admin1: "WV", lat: 38.6, lon: -80.6 },
  { country: "US", admin1: "WI", lat: 44.6, lon: -89.9 },
  { country: "US", admin1: "WY", lat: 43.0, lon: -107.6 },
  { country: "US", admin1: "PR", lat: 18.2, lon: -66.4 },
  // Canada (Health Infobase 'region' values are province/territory names)
  { country: "CA", admin1: "Alberta", lat: 53.9, lon: -116.6 },
  { country: "CA", admin1: "British Columbia", lat: 53.7, lon: -124.0 },
  { country: "CA", admin1: "Manitoba", lat: 53.8, lon: -98.8 },
  { country: "CA", admin1: "New Brunswick", lat: 46.5, lon: -66.5 },
  { country: "CA", admin1: "Newfoundland and Labrador", lat: 53.1, lon: -57.7 },
  { country: "CA", admin1: "Nova Scotia", lat: 45.0, lon: -63.0 },
  { country: "CA", admin1: "Ontario", lat: 50.0, lon: -85.0 },
  { country: "CA", admin1: "Prince Edward Island", lat: 46.5, lon: -63.4 },
  { country: "CA", admin1: "Quebec", lat: 52.0, lon: -72.0 },
  { country: "CA", admin1: "Saskatchewan", lat: 54.0, lon: -106.0 },
  { country: "CA", admin1: "Northwest Territories", lat: 64.8, lon: -124.8 },
  { country: "CA", admin1: "Nunavut", lat: 70.3, lon: -83.1 },
  { country: "CA", admin1: "Yukon", lat: 64.3, lon: -135.0 },
];

// US jurisdictions in CDC data are inconsistent — a mix of 2-letter codes and full
// names, any case. Map both forms to the canonical 2-letter code.
const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "puerto rico": "PR", guam: "GU", "virgin islands": "VI",
};

/**
 * SQL CASE expression mapping a jurisdiction column (full name or 2-letter code, any
 * case) to a canonical 2-letter code. Unknown values pass through uppercased & trimmed.
 */
export function usStateCodeSql(col: string): string {
  const whens = Object.entries(US_STATE_NAME_TO_CODE)
    .map(([name, code]) => `WHEN '${name.toUpperCase()}' THEN '${code}'`)
    .join(" ");
  return `CASE upper(trim(${col})) ${whens} ELSE upper(trim(${col})) END`;
}

/** Build a DuckDB VALUES clause for the static centroids. */
export function centroidsValuesSql(): string {
  const rows = STATIC_CENTROIDS.map(
    (c) =>
      `('${c.country}', '${c.admin1.replace(/'/g, "''")}', ${c.lat}, ${c.lon})`,
  ).join(",\n  ");
  return `(VALUES\n  ${rows}\n) AS t(country, admin1, lat, lon)`;
}
