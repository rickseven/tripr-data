// Cuts country packs out of a Protomaps basemap build with go-pmtiles, one polygon per country. Resumable: files that
// already exist are skipped, and a failed country is reported and left for the next run.
//
//   node scripts/extract-countries.mjs --pmtiles <path to pmtiles(.exe)> --ne <ne_10m_admin_0_countries.geojson> \
//        --out <folder> --maxzoom 9 [--iso ALL | --iso SGP,MYS,...] [--source <build url>]
//
// Output files are named <ISO>-z<maxzoom>.pmtiles, which is what build-catalog.mjs reads (its --source folder).
// The source build and tool versions are recorded in config/sources.json; keep them in step with what you use here.
// Data is cut as whole tiles, so border tiles are complete in both neighbouring packs (spec 6.5).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : acc), []),
);
const config = JSON.parse(readFileSync(join(root, 'config', 'sources.json'), 'utf8'));
const pmtiles = args.pmtiles ? resolve(args.pmtiles) : '';
const nePath = args.ne ? resolve(args.ne) : '';
const outDir = resolve(args.out ?? 'extracts');
const maxzoom = Number(args.maxzoom ?? 9);
const source = args.source ?? config.source.url;
if (!existsSync(pmtiles) || !existsSync(nePath)) throw new Error('pass --pmtiles <binary> and --ne <Natural Earth admin-0 geojson>');
if (!Number.isInteger(maxzoom) || maxzoom < 0 || maxzoom > 15) throw new Error('--maxzoom must be 0 to 15');
mkdirSync(outDir, { recursive: true });
const regionDir = join(outDir, '_regions');
mkdirSync(regionDir, { recursive: true });

const ne = JSON.parse(readFileSync(nePath, 'utf8'));
const byIso = new Map();
for (const f of ne.features) {
  const iso = f.properties.ADM0_A3 ?? f.properties.ISO_A3;
  if (iso && iso !== '-99') byIso.set(iso, f);
}
const wanted = !args.iso || args.iso === 'ALL' ? [...byIso.keys()].sort() : args.iso.split(',');
const unknown = wanted.filter((iso) => !byIso.has(iso));
if (unknown.length) throw new Error(`not in the outline file: ${unknown.join(', ')}`);

const failed = [];
let done = 0;
let skipped = 0;
for (const iso of wanted) {
  const out = join(outDir, `${iso}-z${maxzoom}.pmtiles`);
  if (existsSync(out) && statSync(out).size > 0) {
    skipped++;
    continue;
  }
  const region = join(regionDir, `${iso}.geojson`);
  writeFileSync(region, JSON.stringify({ type: 'Feature', properties: {}, geometry: byIso.get(iso).geometry }));
  const tmp = `${out}.part`;
  rmSync(tmp, { force: true });
  const t0 = Date.now();
  const r = spawnSync(pmtiles, ['extract', source, tmp, `--region=${region}`, `--maxzoom=${maxzoom}`], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(tmp)) {
    failed.push(iso);
    console.error(`${iso}: FAILED (${(r.stderr || r.stdout || '').trim().split('\n').pop()})`);
    rmSync(tmp, { force: true });
    continue;
  }
  renameSync(tmp, out);
  done++;
  console.log(`${iso}: z${maxzoom} ${(statSync(out).size / 1048576).toFixed(2)} MiB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
console.log(`done ${done}, skipped (already there) ${skipped}, failed ${failed.length}${failed.length ? `: ${failed.join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
