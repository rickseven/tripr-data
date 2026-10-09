// Replaces the GitHub account in catalog.json's downloadBase.   node scripts/set-owner.mjs <github account>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const owner = process.argv[2];
if (!owner || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) throw new Error('usage: node scripts/set-owner.mjs <github account>');
const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog.json');
const catalog = JSON.parse(readFileSync(path, 'utf8'));
catalog.downloadBase = catalog.downloadBase.replace(/^(https:\/\/github\.com\/)[^/]+(\/)/, `$1${owner}$2`);
writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`downloadBase = ${catalog.downloadBase}`);
