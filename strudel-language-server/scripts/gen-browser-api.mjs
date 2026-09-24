// Scans a Strudel source checkout for functions/methods that only exist in the
// browser REPL (audio, visuals, MIDI, ...), so the headless evaluator can stub them.
// Usage: node scripts/gen-browser-api.mjs [path/to/strudel]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? join(import.meta.dirname, '../../../PUBLIC/strudel');
const BROWSER_PACKAGES = ['draw', 'edo', 'webaudio', 'superdough', 'codemirror', 'hydra', 'soundfonts', 'midi', 'repl', 'gamepad', 'motion', 'mqtt', 'osc', 'serial', 'csound'];

const files = [];
const collect = (dir) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'test', 'bench'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p);
    else if (/\.m?js$/.test(name) && !/\.test\./.test(name)) files.push(p);
  }
};
for (const pkg of BROWSER_PACKAGES) {
  try { collect(join(root, 'packages', pkg)); } catch {}
}

const methods = new Set();
const globals = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const [, name] of src.matchAll(/Pattern\.prototype\.([A-Za-z_$][\w$]*)\s*=/g)) methods.add(name);
  for (const [, name] of src.matchAll(/\bregisterWidget\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) methods.add(name);
  for (const [, args] of src.matchAll(/\bregister(?:Control)?\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
    for (const [, name] of args.matchAll(/['"]([A-Za-z_$][\w$]*)['"]/g)) {
      methods.add(name);
      globals.add(name);
    }
  }
  for (const [, name] of src.matchAll(/export\s+(?:async\s+)?(?:const|let|function\*?)\s+([A-Za-z_$][\w$]*)/g)) globals.add(name);
}
// The transpiler rewrites these calls.
globals.add('sliderWithID');
globals.add('all');
globals.add('each');

const out = { methods: [...methods].sort(), globals: [...globals].sort() };
writeFileSync(join(import.meta.dirname, '../src/browser-api.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${out.methods.length} methods, ${out.globals.length} globals from ${files.length} files`);
