// Copies the JSON schemas generated into src/schemas into dist/schemas so they
// ship next to the compiled backend. Replaces the deprecated `cpx` package,
// which pulled in glob@7/inflight, chokidar@1 (braces vuln) and core-js@2.
const { cpSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const src = join(__dirname, '..', 'src', 'schemas');
const dest = join(__dirname, '..', 'dist', 'schemas');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
