// Bundles the server into self-contained files so the published package has no
// runtime dependencies (and so Node resolves Strudel's ESM builds correctly).
import { build } from 'esbuild';
import { chmodSync } from 'node:fs';

const entryPoints = ['src/server.mjs', 'src/cli.mjs', 'src/eval-worker.mjs'];
await build({
  entryPoints,
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  mainFields: ['module', 'main'],
  logLevel: 'warning',
  // Some bundled CommonJS deps call require().
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
for (const f of ['dist/server.mjs', 'dist/cli.mjs']) chmodSync(f, 0o755);
console.log('built', entryPoints.length, 'entry points');
