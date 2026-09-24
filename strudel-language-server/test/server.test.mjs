import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

function startServer() {
  const proc = spawn(process.execPath, ['dist/server.mjs', '--stdio'], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = Buffer.alloc(0);
  const listeners = [];
  proc.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const sep = buf.indexOf('\r\n\r\n');
      if (sep < 0) break;
      const len = Number(/Content-Length: (\d+)/i.exec(buf.subarray(0, sep).toString())[1]);
      if (buf.length < sep + 4 + len) break;
      const msg = JSON.parse(buf.subarray(sep + 4, sep + 4 + len).toString());
      buf = buf.subarray(sep + 4 + len);
      listeners.forEach((l) => l(msg));
    }
  });
  const send = (msg) => {
    const body = JSON.stringify({ jsonrpc: '2.0', ...msg });
    proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  };
  const waitFor = (pred, ms = 8000) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), ms);
      listeners.push((m) => pred(m) && (clearTimeout(t), resolve(m)));
    });
  return { proc, send, waitFor };
}

async function diagnosticsFor(text, { settle = false } = {}) {
  const s = startServer();
  s.send({ id: 1, method: 'initialize', params: { processId: null, rootUri: null, capabilities: {} } });
  await s.waitFor((m) => m.id === 1);
  s.send({ method: 'initialized', params: {} });
  const uri = 'file:///tmp/test.strudel';
  const all = [];
  s.waitFor((m) => { if (m.method === 'textDocument/publishDiagnostics') all.push(m.params.diagnostics); return false; }, 60000).catch(() => {});
  s.send({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'strudel', version: 1, text } } });
  await new Promise((r) => setTimeout(r, settle ? 4000 : 300));
  s.proc.kill();
  return all.at(-1) ?? [];
}

test('reports mini-notation errors at the offending bracket', async () => {
  const d = await diagnosticsFor('$: s("bd [sd hh")\n');
  assert.equal(d.length, 1);
  assert.match(d[0].message, /Unclosed '\['/);
  assert.deepEqual(d[0].range.start, { line: 0, character: 9 });
});

test('reports JavaScript syntax errors', async () => {
  const d = await diagnosticsFor('$: s("bd*4").gain(0.5\n');
  assert.equal(d.length, 1);
  assert.equal(d[0].severity, 1);
});

test('reports runtime errors at the misspelled method', async () => {
  const d = await diagnosticsFor('setcpm(30)\n$: s("bd*4").gian(0.5)\n', { settle: true });
  assert.equal(d.length, 1);
  assert.match(d[0].message, /gian is not a function/);
  assert.deepEqual(d[0].range, { start: { line: 1, character: 13 }, end: { line: 1, character: 17 } });
});

test('valid code using browser-only functions is clean', async () => {
  const code = readFileSync(new URL('./fixtures/valid.strudel', import.meta.url), 'utf8');
  const d = await diagnosticsFor(code, { settle: true });
  assert.deepEqual(d, []);
});
