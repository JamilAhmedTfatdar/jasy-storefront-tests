// Store names and links. They come from the same file the Playwright tests use,
// so there is one place to change them: ../tests/data/site.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const site = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', 'tests', 'data', 'site.json'), 'utf8'));
