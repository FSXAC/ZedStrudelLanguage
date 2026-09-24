// Runs in a sandboxed child process (see evaluator.mjs): evaluates Strudel
// code headlessly (no audio, no visuals) and queries each pattern to surface
// runtime errors.
import { registerHooks } from 'node:module';
import * as core from '@strudel/core';
import * as mini from '@strudel/mini';
import * as tonal from '@strudel/tonal';
import { transpiler } from '@strudel/transpiler';
import browserApi from './browser-api.json' with { type: 'json' };

const QUERY_CYCLES = 8;
const { evalScope, evaluate, Pattern, silence, pure } = core;

// Strudel reports some problems (e.g. bad scale names) through its logger,
// which prints `%c<message>` via console.log.
let logs = [];
const originalLog = console.log;
console.log = (first, ...rest) => {
  if (typeof first === 'string' && first.startsWith('%c')) logs.push(first.slice(2));
  else originalLog.call(console, first, ...rest);
};
console.info = console.debug = () => {};
console.warn = (...args) => logs.push(args.join(' '));

await evalScope(core, mini, tonal);

// Stub the browser-only API so valid code doesn't produce false positives.
const noop = () => {};
const globalStubs = {
  sliderWithID: (_id, value) => pure(value),
  setcpm: noop, setcps: noop, setCpm: noop, setCps: noop, hush: noop, samples: noop,
  all: noop, each: noop,
};
for (const name of browserApi.globals) {
  if (!(name in globalThis)) globalThis[name] = globalStubs[name] ?? (() => silence);
}
for (const [name, fn] of Object.entries(globalStubs)) if (!(name in globalThis)) globalThis[name] = fn;
for (const name of browserApi.methods) {
  if (!(name in Pattern.prototype)) Pattern.prototype[name] = function () { return this; };
}

let patterns = [];
Pattern.prototype.p = function (id) {
  patterns.push({ id: String(id), pattern: this });
  return this;
};

const takeLogs = () => {
  const out = logs.filter((m) => /error|warn|not found|unknown|invalid/i.test(m));
  logs = [];
  return out;
};

const RESET_MARKER = '\u0000reset';

async function run(code) {
  patterns = [];
  // Strudel's logger drops a message identical to the previous one within 1s;
  // log a marker so repeated evaluations still report the same warning.
  core.logger(RESET_MARKER);
  logs = [];
  const results = [];
  try {
    await evaluate(code, transpiler, { emitWidgets: false });
  } catch (e) {
    results.push({ severity: 'error', message: e?.message ?? String(e), errorType: e?.name });
    return results;
  }
  for (const m of takeLogs()) results.push({ severity: 'warning', message: m });
  patterns.forEach(({ id, pattern }, index) => {
    // Muted patterns (`_$:`) are never played by Strudel.
    if (id.startsWith('_')) return;
    try {
      pattern.queryArc(0, QUERY_CYCLES);
    } catch (e) {
      results.push({ severity: 'error', message: e?.message ?? String(e), errorType: e?.name, patternIndex: index });
    }
    for (const m of takeLogs()) results.push({ severity: 'warning', message: m, patternIndex: index });
  });
  return results;
}

// Lock down the sandbox before running any user code. Everything Strudel needs
// is bundled, so no further imports are required.
const hostProcess = process;
const send = hostProcess.send.bind(hostProcess);
const onMessage = (handler) => hostProcess.on('message', handler);
registerHooks?.({
  resolve(specifier) {
    throw new Error(`import('${specifier}') is not available in the Strudel linter`);
  },
});
for (const name of ['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource', 'require']) delete globalThis[name];
globalThis.process = { env: { NODE_ENV: 'production' }, versions: {}, platform: 'browser' };

onMessage(async ({ id, code }) => {
  let results;
  try {
    results = await run(code);
  } catch (e) {
    results = [{ severity: 'error', message: e?.message ?? String(e) }];
  }
  send({ id, results });
});
send({ ready: true });
