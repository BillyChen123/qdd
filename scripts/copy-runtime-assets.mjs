import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const copies = [
  {
    from: path.join(repoRoot, 'src', 'runtime', 'bootstrap-prompts'),
    to: path.join(repoRoot, 'dist', 'runtime', 'bootstrap-prompts'),
  },
];

for (const entry of copies) {
  await fs.mkdir(entry.to, { recursive: true });
  await fs.cp(entry.from, entry.to, { recursive: true });
}
