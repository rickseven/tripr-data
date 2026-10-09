// Minimal reader for the fixed 127-byte PMTiles v3 header (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md).
import { closeSync, openSync, readSync } from 'node:fs';

export function readPmtilesHeader(path) {
  const buf = Buffer.alloc(127);
  const fd = openSync(path, 'r');
  try {
    if (readSync(fd, buf, 0, 127, 0) < 127) throw new Error('file is shorter than a PMTiles header');
  } finally {
    closeSync(fd);
  }
  if (buf.toString('latin1', 0, 7) !== 'PMTiles') throw new Error('missing PMTiles magic');
  if (buf[7] !== 3) throw new Error(`unsupported PMTiles version ${buf[7]}`);
  const e7 = (offset) => buf.readInt32LE(offset) / 1e7;
  return {
    tileType: buf[99],
    minZoom: buf[100],
    maxZoom: buf[101],
    // [west, south, east, north] in degrees
    bbox: [e7(102), e7(106), e7(110), e7(114)],
    addressedTiles: Number(buf.readBigUInt64LE(72)),
  };
}
