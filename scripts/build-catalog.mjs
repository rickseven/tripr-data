// Builds catalog.json and fills release-assets/ from a directory of PMTiles extracts.
//
//   node scripts/build-catalog.mjs --source <dir with <ISO>-z<N>.pmtiles> [--owner <github account>]
//
// For every country in config/sources.json the highest zoom that fits each size budget (lite, standard, detail) is
// chosen from the extracts in --source. Tiers that would point at the same file as a lower tier are left out.
// Chosen files are copied to release-assets/ (git-ignored, uploaded as GitHub Release assets) and hashed.
// Without --owner the download URL keeps the placeholder __OWNER__; scripts/verify.mjs --release refuses to pass with it.
import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPmtilesHeader } from './lib/pmtiles-header.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : acc), []),
);
const config = JSON.parse(readFileSync(join(root, 'config', 'sources.json'), 'utf8'));
const sourceDir = args.source;
if (!sourceDir || !existsSync(sourceDir)) throw new Error('pass --source <directory with the extracts>');
const owner = args.owner ?? '__OWNER__';
const assetsDir = join(root, 'release-assets');
mkdirSync(assetsDir, { recursive: true });

const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

const MAX_ASSET_BYTES = 2 * 1024 ** 3 - 1; // GitHub Release assets must be smaller than 2 GiB

const countries = [];
for (const c of config.countries) {
  const candidates = readdirSync(sourceDir)
    .filter((f) => f.startsWith(`${c.iso}-z`) && f.endsWith('.pmtiles'))
    .map((file) => {
      const path = join(sourceDir, file);
      const header = readPmtilesHeader(path);
      return { file, path, bytes: statSync(path).size, ...header };
    })
    .sort((a, b) => a.maxZoom - b.maxZoom);
  if (candidates.length === 0) throw new Error(`no extracts for ${c.iso} in ${sourceDir}`);

  const packs = [];
  for (const tier of ['lite', 'standard', 'detail']) {
    const budget = config.budgetsMB[tier] * 1024 * 1024;
    const fitting = candidates.filter((x) => x.bytes <= budget);
    // Nothing fits the smallest budget: ship the smallest extract rather than no pack at all.
    const pick = fitting.length ? fitting[fitting.length - 1] : tier === 'lite' ? candidates[0] : undefined;
    if (!pick || packs.some((p) => p.file === pick.file)) continue;
    if (pick.bytes > MAX_ASSET_BYTES) throw new Error(`${pick.file} is too large for a release asset`);
    copyFileSync(pick.path, join(assetsDir, pick.file));
    packs.push({
      tier,
      file: pick.file,
      minzoom: pick.minZoom,
      maxzoom: pick.maxZoom,
      bytes: pick.bytes,
      sha256: await sha256(pick.path),
    });
  }
  const bbox = candidates[0].bbox.map((v) => Math.round(v * 1e4) / 1e4);
  countries.push({ iso: c.iso, name: c.name, bbox, packs });
  console.log(`${c.iso}: ${packs.map((p) => `${p.tier}=z${p.maxzoom} (${(p.bytes / 1048576).toFixed(1)} MB)`).join(', ')}`);
}

const catalog = {
  schemaVersion: 1,
  version: config.version,
  releaseTag: config.releaseTag,
  sourceBuild: config.source.build,
  license: config.license,
  attribution: config.attribution,
  downloadBase: `https://github.com/${owner}/${config.repo}/releases/download/${config.releaseTag}/`,
  countries,
};
writeFileSync(join(root, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
const total = countries.flatMap((c) => c.packs).reduce((s, p) => s + p.bytes, 0);
console.log(`catalog.json written: ${countries.length} countries, ${countries.flatMap((c) => c.packs).length} packs, ${(total / 1073741824).toFixed(2)} GiB`);
