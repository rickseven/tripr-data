// Adds the `routing` section to catalog.json: BRouter data segments (.rd5, one per 5° by 5° square) and the segments
// each country in the catalog needs. Segment files are copied to routing-assets/ (git-ignored, uploaded as GitHub
// Release assets under the routing release tag) and hashed.
//
//   node scripts/build-routing.mjs --source <dir with E105_S10.rd5 ...> [--owner <github account>] [--partial]
//
// A country needs every 5° square its bounding box touches (the box comes from catalog.json). Without --partial the
// run fails when a square is missing from --source; with --partial, countries that are not fully covered are left
// out and listed. With --skip-missing, squares that are absent from --source are dropped from a country's list instead
// (BRouter publishes no file for squares without roads, such as open sea); a country with no square left is still an error.
// Settings live in config/sources.json under "routing".
import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { segmentsForBbox } from './lib/segments.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : acc), []),
);
const config = JSON.parse(readFileSync(join(root, 'config', 'sources.json'), 'utf8'));
const catalogPath = join(root, 'catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const routing = config.routing;
if (!routing) throw new Error('config/sources.json has no "routing" section');
const sourceDir = args.source;
if (!sourceDir || !existsSync(sourceDir)) throw new Error('pass --source <directory with the .rd5 segments>');
const owner = args.owner ?? /github\.com\/([^/]+)\//.exec(catalog.downloadBase)?.[1] ?? '__OWNER__';
const assetsDir = join(root, 'routing-assets');
mkdirSync(assetsDir, { recursive: true });

const MAX_ASSET_BYTES = 2 * 1024 ** 3 - 1; // GitHub Release assets must be smaller than 2 GiB

const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

const countries = {};
const skipped = [];
for (const c of catalog.countries) {
  const names = segmentsForBbox(c.bbox);
  const missing = names.filter((n) => !existsSync(join(sourceDir, n)));
  if (missing.length && args['skip-missing'] && missing.length < names.length) {
    // BRouter publishes no file for squares without roads (open sea): drop them from the list.
    console.log(`${c.iso}: dropped squares without a file: ${missing.join(', ')}`);
    countries[c.iso] = names.filter((n) => !missing.includes(n));
    continue;
  }
  if (missing.length) {
    if (!args.partial) throw new Error(`${c.iso}: missing ${missing.length} of ${names.length} segments in ${sourceDir}: ${missing.join(', ')} (use --partial to skip such countries)`);
    skipped.push(`${c.iso} (missing ${missing.join(', ')})`);
    continue;
  }
  countries[c.iso] = names;
}

const files = [...new Set(Object.values(countries).flat())].sort();
const segments = [];
for (const file of files) {
  const path = join(sourceDir, file);
  const bytes = statSync(path).size;
  if (bytes <= 0) throw new Error(`${file} is empty`);
  if (bytes > MAX_ASSET_BYTES) throw new Error(`${file} is too large for a release asset`);
  copyFileSync(path, join(assetsDir, file));
  segments.push({ file, bytes, sha256: await sha256(path) });
}

catalog.routing = {
  version: routing.version,
  releaseTag: routing.releaseTag,
  source: routing.source.name,
  license: routing.license,
  attribution: routing.attribution,
  downloadBase: `https://github.com/${owner}/${config.repo}/releases/download/${routing.releaseTag}/`,
  segments,
  countries,
};
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
const total = segments.reduce((s, x) => s + x.bytes, 0);
for (const [iso, names] of Object.entries(countries)) console.log(`${iso}: ${names.length} segments`);
if (skipped.length) console.log(`skipped: ${skipped.join('; ')}`);
console.log(`catalog.json routing written: ${Object.keys(countries).length} countries, ${segments.length} segments, ${(total / 1048576).toFixed(1)} MiB`);
