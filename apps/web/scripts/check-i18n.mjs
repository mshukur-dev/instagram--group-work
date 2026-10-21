// Fails if en.json and ru.json don't have the same keys (see docs/spec/i18n.md)
import { readFileSync } from 'node:fs';

const load = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)));

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const en = new Set(keys(load('en')));
const ru = new Set(keys(load('ru')));
const missingInRu = [...en].filter((key) => !ru.has(key));
const missingInEn = [...ru].filter((key) => !en.has(key));

if (missingInRu.length || missingInEn.length) {
  if (missingInRu.length) console.error('Missing in ru.json:', missingInRu.join(', '));
  if (missingInEn.length) console.error('Missing in en.json:', missingInEn.join(', '));
  process.exit(1);
}
console.log(`i18n OK: ${en.size} keys`);
