// Checks that never execute user code: JavaScript syntax and mini-notation syntax.
import { parse as parseJS } from 'acorn';
import { ancestor as walkAncestor } from 'acorn-walk';
import { parse as parseMini } from '@strudel/mini/krill-parser.js';

export const Severity = { Error: 1, Warning: 2 };

// Same options as @strudel/transpiler.
export function parseStrudel(code) {
  const comments = [];
  const ast = parseJS(code, {
    ecmaVersion: 2022,
    allowAwaitOutsideFunction: true,
    locations: true,
    onComment: comments,
  });
  return { ast, comments };
}

// `// mini-off` ... `// mini-on` disables mini-notation parsing (see @strudel/transpiler).
function miniDisabledRanges(comments, codeEnd) {
  const ranges = [];
  const stack = [];
  for (const c of comments) {
    const value = c.value.trim();
    if (value.startsWith('mini-off')) stack.push(c.start);
    else if (value.startsWith('mini-on') && stack.length) ranges.push([stack.pop(), c.end]);
  }
  while (stack.length) ranges.push([stack.pop(), codeEnd]);
  return ranges;
}

// Strings Strudel parses as mini-notation: double-quoted literals and untagged template literals.
export function collectMiniStrings(ast, comments, code) {
  const disabled = miniDisabledRanges(comments, code.length);
  const isDisabled = (off) => disabled.some(([s, e]) => off >= s && off < e);
  const strings = [];
  walkAncestor(ast, {
    Literal(node) {
      if (typeof node.value === 'string' && node.raw[0] === '"' && !isDisabled(node.start)) {
        strings.push({ text: node.value, start: node.start + 1, end: node.end - 1 });
      }
    },
    TemplateLiteral(node, _state, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (parent?.type === 'TaggedTemplateExpression' || isDisabled(node.start)) return;
      const quasi = node.quasis[0];
      strings.push({ text: quasi.value.raw, start: quasi.start, end: quasi.end, hasExpressions: node.expressions.length > 0 });
    },
  });
  return strings;
}

const OPEN = { '[': ']', '<': '>', '{': '}', '(': ')' };
const CLOSE = Object.fromEntries(Object.entries(OPEN).map(([o, c]) => [c, o]));

// Friendlier messages for the most common mistake: unbalanced brackets.
function checkBrackets(text) {
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (OPEN[ch]) stack.push({ ch, i });
    else if (CLOSE[ch]) {
      const top = stack.pop();
      if (!top) return { offset: i, length: 1, message: `Unmatched '${ch}' in mini-notation` };
      if (top.ch !== CLOSE[ch]) {
        return { offset: i, length: 1, message: `Expected '${OPEN[top.ch]}' to close '${top.ch}' but found '${ch}'` };
      }
    }
  }
  const top = stack.pop();
  if (top) return { offset: top.i, length: 1, message: `Unclosed '${top.ch}' in mini-notation` };
  return null;
}

function describeFound(found) {
  if (found == null || found === '"') return 'end of pattern';
  return `'${found}'`;
}

export function checkMini(text) {
  const bracket = checkBrackets(text);
  if (bracket) return bracket;
  try {
    parseMini(`"${text}"`);
    return null;
  } catch (e) {
    if (!e.location) return { offset: 0, length: text.length, message: `Invalid mini-notation: ${e.message}` };
    // -1 compensates for the opening quote we added.
    const offset = Math.max(0, Math.min(e.location.start.offset - 1, text.length - 1));
    return { offset, length: 1, message: `Invalid mini-notation: unexpected ${describeFound(e.found)}` };
  }
}

// Returns { ast, comments, diagnostics } with diagnostics as { start, end, message, severity }.
export function staticCheck(code) {
  let parsed;
  try {
    parsed = parseStrudel(code);
  } catch (e) {
    const pos = e.pos ?? 0;
    return {
      diagnostics: [{ start: pos, end: pos + 1, severity: Severity.Error, message: e.message.replace(/\s*\(\d+:\d+\)$/, '') }],
    };
  }
  const { ast, comments } = parsed;
  const diagnostics = [];
  for (const s of collectMiniStrings(ast, comments, code)) {
    // Template strings with ${} are only partially mini-notation; skip them.
    if (s.hasExpressions) continue;
    const err = checkMini(s.text);
    if (err) {
      const start = s.start + err.offset;
      diagnostics.push({ start, end: Math.min(start + err.length, s.end || start + 1), severity: Severity.Error, message: err.message });
    }
  }
  return { ast, comments, diagnostics };
}
