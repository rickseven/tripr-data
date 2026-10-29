// Checks that catalog.json and release-assets/ agree, and that the repo is ready to publish.
//
//   node scripts/verify.mjs            structure, sizes and hashes
//   node scripts/verify.mjs --release  additionally refuses placeholders and oversized files
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPmtilesHeader } from './lib/pmtiles-header.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const release = process.argv.includes('--release');
const problems = [];
const fail = (m) => problems.push(m);

const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));
if (catalog.schemaVersion !== 1) fail(`unsupported schemaVersion ${catalog.schemaVersion}`);
if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/$/.test(catalog.downloadBase)) fail(`odd downloadBase ${catalog.downloadBase}`);
if (release && catalog.downloadBase.includes('__OWNER__')) fail('downloadBase still contains __OWNER__ (run build-catalog with --owner)');

const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

const listed = new Set();
const isos = new Set();
for (const c of catalog.countries) {
  if (isos.has(c.iso)) fail(`duplicate country ${c.iso}`);
  isos.add(c.iso);
  if (!/^[A-Z]{3}$/.test(c.iso)) fail(`bad ISO code ${c.iso}`);
  if (!Array.isArray(c.bbox) || c.bbox.length !== 4 || c.bbox[0] >= c.bbox[2] || c.bbox[1] >= c.bbox[3]) fail(`${c.iso}: bad bbox`);
  if (c.packs.length === 0) fail(`${c.iso}: no packs`);
  const tiers = new Set();
  for (const p of c.packs) {
    if (tiers.has(p.tier)) fail(`${c.iso}: duplicate tier ${p.tier}`);
    tiers.add(p.tier);
    listed.add(p.file);
    const path = join(root, 'release-assets', p.file);
    if (!existsSync(path)) {
      fail(`${p.file}: missing from release-assets/`);
      continue;
    }
    const size = statSync(path).size;
    if (size !== p.bytes) fail(`${p.file}: size ${size} differs from catalog ${p.bytes}`);
    if (size >= 2 * 1024 ** 3) fail(`${p.file}: not smaller than 2 GiB`);
    const h = readPmtilesHeader(path);
    if (h.maxZoom !== p.maxzoom || h.minZoom !== p.minzoom) fail(`${p.file}: zoom range differs from header`);
    if ((await sha256(path)) !== p.sha256) fail(`${p.file}: sha256 differs from catalog`);
  }
}
for (const f of readdirSync(join(root, 'release-assets')).filter((f) => f.endsWith('.pmtiles'))) {
  if (!listed.has(f)) fail(`${f}: in release-assets/ but not in catalog.json`);
}
// Routing section (optional): every listed segment must be in routing-assets/ with the recorded size and hash, every
// country must name listed segments, and nothing may sit in routing-assets/ without being listed.
if (catalog.routing) {
  const r = catalog.routing;
  if (release && r.downloadBase.includes('__OWNER__')) fail('routing.downloadBase still contains __OWNER__');
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/$/.test(r.downloadBase)) fail(`odd routing.downloadBase ${r.downloadBase}`);
  const routingDir = join(root, 'routing-assets');
  const names = new Set();
  for (const s of r.segments) {
    if (!/^[EW]\d{1,3}_[NS]\d{1,2}\.rd5$/.test(s.file)) fail(`routing: bad segment name ${s.file}`);
    if (names.has(s.file)) fail(`routing: duplicate segment ${s.file}`);
    names.add(s.file);
    const path = join(routingDir, s.file);
    if (!existsSync(path)) {
      fail(`routing: ${s.file} missing from routing-assets/`);
      continue;
    }
    const size = statSync(path).size;
    if (size !== s.bytes) fail(`routing: ${s.file} size ${size} differs from catalog ${s.bytes}`);
    if (size >= 2 * 1024 ** 3) fail(`routing: ${s.file} not smaller than 2 GiB`);
    if ((await sha256(path)) !== s.sha256) fail(`routing: ${s.file} sha256 differs from catalog`);
  }
  for (const [iso, files] of Object.entries(r.countries)) {
    if (!isos.has(iso)) fail(`routing: ${iso} is not a country of the catalog`);
    if (files.length === 0) fail(`routing: ${iso} has no segments`);
    for (const f of files) if (!names.has(f)) fail(`routing: ${iso} needs unlisted segment ${f}`);
  }
  if (existsSync(routingDir)) {
    for (const f of readdirSync(routingDir).filter((f) => f.endsWith('.rd5'))) if (!names.has(f)) fail(`routing: ${f} in routing-assets/ but not in catalog.json`);
  }
}
for (const required of ['index.html', '.nojekyll', 'NOTICE.md', 'README.md', '.github/CODEOWNERS', '.github/SETTINGS.md', '.github/workflows/guard.yml', '.github/ruleset-main.json', '.github/ruleset-tags.json']) {
  if (!existsSync(join(root, required))) fail(`missing ${required}`);
}

// The protection files must name the maintainer and parse; the real blocking is done by GitHub settings (.github/SETTINGS.md).
const MAINTAINER = 'rickseven';
if (existsSync(join(root, '.github/CODEOWNERS')) && !readFileSync(join(root, '.github/CODEOWNERS'), 'utf8').includes(`* @${MAINTAINER}`)) fail('CODEOWNERS does not make the maintainer the owner of everything');
if (existsSync(join(root, '.github/workflows/guard.yml')) && !readFileSync(join(root, '.github/workflows/guard.yml'), 'utf8').includes(`MAINTAINER: ${MAINTAINER}`)) fail('guard workflow does not name the maintainer');
for (const f of ['ruleset-main.json', 'ruleset-tags.json']) {
  try {
    const r = JSON.parse(readFileSync(join(root, '.github', f), 'utf8'));
    if (!r.rules?.some((x) => x.type === 'deletion')) fail(`${f}: no deletion rule`);
  } catch (e) {
    fail(`${f}: ${e.message}`);
  }
}
if (release && !catalog.downloadBase.includes(`/${MAINTAINER}/`)) fail(`downloadBase is not under github.com/${MAINTAINER}/`);

if (problems.length) {
  console.error(`verify FAILED (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`verify OK: ${catalog.countries.length} countries, ${listed.size} packs${catalog.routing ? `, ${catalog.routing.segments.length} routing segments` : ''}${release ? ', ready for release' : ''}`);
