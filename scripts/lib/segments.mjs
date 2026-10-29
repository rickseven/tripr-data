// Names of BRouter data segments. A segment is a 5° by 5° square named after its south-west corner:
// E105_S10.rd5 covers longitude 105..110 and latitude -10..-5.

export const segmentName = (lon, lat) => `${lon >= 0 ? 'E' : 'W'}${Math.abs(lon)}_${lat >= 0 ? 'N' : 'S'}${Math.abs(lat)}.rd5`;

/** Every square a [west, south, east, north] box touches. A box edge exactly on a boundary does not pull in the next square. */
export function segmentsForBbox([west, south, east, north]) {
  const EPS = 1e-9;
  const names = [];
  for (let lat = Math.floor(south / 5) * 5; lat <= Math.floor((north - EPS) / 5) * 5; lat += 5) {
    for (let lon = Math.floor(west / 5) * 5; lon <= Math.floor((east - EPS) / 5) * 5; lon += 5) names.push(segmentName(lon, lat));
  }
  return names;
}
