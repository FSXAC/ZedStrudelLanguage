// Maps evaluation results (which carry no source positions) back onto the AST.
import { full as walkFull } from 'acorn-walk';
import { Severity } from './static-checks.mjs';

function collect(ast) {
  const labels = [];
  const members = [];
  const identifiers = [];
  const strings = [];
  walkFull(ast, (node) => {
    switch (node.type) {
      case 'LabeledStatement':
        labels.push(node);
        break;
      case 'MemberExpression':
        if (!node.computed && node.property.type === 'Identifier') members.push(node.property);
        break;
      case 'Identifier':
        identifiers.push(node);
        break;
      case 'Literal':
        if (typeof node.value === 'string') strings.push(node);
        break;
      case 'TemplateLiteral':
        if (node.expressions.length === 0) strings.push({ ...node, value: node.quasis[0].value.cooked });
        break;
    }
  });
  const byStart = (a, b) => a.start - b.start;
  labels.sort(byStart);
  return { labels, members, identifiers: identifiers.filter((id) => !members.includes(id)), strings };
}

const within = (node, scope) => !scope || (node.start >= scope.start && node.end <= scope.end);

export function locateEvalResults(results, ast, code) {
  const index = collect(ast);
  const firstLineEnd = code.indexOf('\n') === -1 ? code.length : code.indexOf('\n');
  const diagnostics = [];

  for (const r of results) {
    const severity = r.severity === 'error' ? Severity.Error : Severity.Warning;
    const scope = r.patternIndex != null ? index.labels[r.patternIndex] : undefined;
    let nodes = [];

    const notFn = r.message.match(/([A-Za-z_$][\w$]*) is not a function/);
    const notDefined = r.message.match(/([A-Za-z_$][\w$]*) is not defined/);
    if (notFn) {
      const name = notFn[1];
      nodes = [...index.members, ...index.identifiers].filter((n) => n.name === name && within(n, scope));
    } else if (notDefined) {
      nodes = index.identifiers.filter((n) => n.name === notDefined[1] && within(n, scope));
    } else {
      // e.g. "[tonal] error: Scale name C4 minorr is incomplete" -> the "C4:minorr" string
      const normalized = r.message.toLowerCase();
      nodes = index.strings.filter((s) => {
        if (!within(s, scope) || !s.value || s.value.length < 2) return false;
        const v = s.value.toLowerCase();
        return normalized.includes(v) || normalized.includes(v.replaceAll(':', ' '));
      });
    }

    if (nodes.length === 0) {
      if (scope) nodes = [scope.label];
      else nodes = [{ start: 0, end: Math.max(1, firstLineEnd) }];
    }
    const message = r.message.startsWith('[') ? r.message : `Strudel: ${r.message}`;
    for (const n of nodes) diagnostics.push({ start: n.start, end: n.end, severity, message });
  }
  return diagnostics;
}
