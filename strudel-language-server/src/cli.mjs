#!/usr/bin/env node
// Standalone linter: `strudel-lint [--no-eval] file.strudel ...`
// Exits with 1 if any errors were found.
import { readFileSync } from 'node:fs';
import { staticCheck } from './static-checks.mjs';
import { locateEvalResults } from './locate.mjs';
import { Evaluator } from './evaluator.mjs';

const args = process.argv.slice(2);
const evaluate = !args.includes('--no-eval');
const files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('usage: strudel-lint [--no-eval] <file>...');
  process.exit(2);
}

const lineCol = (code, off) => {
  const lines = code.slice(0, off).split('\n');
  return `${lines.length}:${lines.at(-1).length + 1}`;
};

let evaluator;
let errors = 0;
for (const file of files) {
  const code = readFileSync(file, 'utf8');
  let { ast, diagnostics } = staticCheck(code);
  if (evaluate && ast && diagnostics.length === 0) {
    evaluator ??= new Evaluator();
    diagnostics = locateEvalResults(await evaluator.evaluate(code), ast, code);
  }
  for (const d of diagnostics) {
    if (d.severity === 1) errors++;
    console.log(`${file}:${lineCol(code, d.start)}: ${d.severity === 1 ? 'error' : 'warning'}: ${d.message}`);
  }
}
evaluator?.dispose();
process.exit(errors > 0 ? 1 : 0);
