#!/usr/bin/env node
// Strudel language server: diagnostics only. Reports JavaScript and
// mini-notation syntax errors, and (optionally) runtime errors found by
// evaluating the code headlessly — the same errors strudel.cc would show.
import { createConnection, ProposedFeatures, TextDocuments, TextDocumentSyncKind, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { staticCheck } from './static-checks.mjs';
import { locateEvalResults } from './locate.mjs';
import { Evaluator } from './evaluator.mjs';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const settings = { evaluate: true, evaluateDelayMs: 400, evaluateTimeoutMs: 3000 };
let evaluator = null;
const timers = new Map();

connection.onInitialize((params) => {
  Object.assign(settings, params.initializationOptions ?? {});
  return {
    capabilities: { textDocumentSync: TextDocumentSyncKind.Incremental },
    serverInfo: { name: 'strudel-language-server' },
  };
});

connection.onDidChangeConfiguration((change) => {
  const s = change.settings?.['strudel-language-server'] ?? change.settings;
  if (s && typeof s === 'object') Object.assign(settings, s);
  documents.all().forEach(schedule);
});

function toLsp(doc, d) {
  return {
    range: { start: doc.positionAt(d.start), end: doc.positionAt(d.end) },
    severity: d.severity === 1 ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    source: 'strudel',
    message: d.message,
  };
}

function publish(doc, diagnostics) {
  connection.sendDiagnostics({ uri: doc.uri, version: doc.version, diagnostics: diagnostics.map((d) => toLsp(doc, d)) });
}

function schedule(doc) {
  const code = doc.getText();
  const { ast, diagnostics } = staticCheck(code);
  publish(doc, diagnostics);

  clearTimeout(timers.get(doc.uri));
  // Only evaluate code that would get past Strudel's parser.
  if (!settings.evaluate || !ast || diagnostics.length > 0) return;
  const version = doc.version;
  timers.set(
    doc.uri,
    setTimeout(async () => {
      evaluator ??= new Evaluator({ timeoutMs: settings.evaluateTimeoutMs });
      const results = await evaluator.evaluate(code);
      const current = documents.get(doc.uri);
      if (!current || current.version !== version) return;
      publish(current, locateEvalResults(results, ast, code));
    }, settings.evaluateDelayMs),
  );
}

documents.onDidChangeContent((e) => schedule(e.document));
documents.onDidClose((e) => {
  clearTimeout(timers.get(e.document.uri));
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});
connection.onShutdown(() => evaluator?.dispose());

documents.listen(connection);
connection.listen();
