/**
 * Tree-sitter grammar for Strudel mini-notation, the pattern language used
 * inside double-quoted and backtick strings, e.g. "<[bd sd]*2 hh(3,8)>".
 * See https://strudel.cc/learn/mini-notation/
 */

const OPERAND = ($) =>
  choice($.number, $.note, $.word, $.subsequence, $.alternation, $.polymeter);

module.exports = grammar({
  name: 'strudel_mini',

  extras: (_) => [/\s/],

  rules: {
    source: ($) => repeat($._item),

    _item: ($) =>
      choice(
        $.number,
        $.note,
        $.word,
        $.rest,
        $.elongation,
        $.subsequence,
        $.alternation,
        $.polymeter,
        $.euclid,
        $.modifier,
        $.stack_separator,
        $.choice_separator,
        $.group_separator,
        $.range,
      ),

    // [a b c]
    subsequence: ($) => seq('[', repeat($._item), ']'),
    // <a b c>  one per cycle
    alternation: ($) => seq('<', repeat($._item), '>'),
    // {a b c}%4
    polymeter: ($) => seq('{', repeat($._item), '}'),
    // bd(3,8,2)
    euclid: ($) => seq('(', repeat($._item), ')'),

    modifier: ($) =>
      prec.right(
        choice(
          seq(field('operator', choice('*', '/', '%', ':')), field('value', OPERAND($))),
          seq(field('operator', choice('@', '!', '?')), optional(field('value', $.number))),
        ),
      ),

    stack_separator: (_) => ',',
    choice_separator: (_) => '|',
    group_separator: (_) => '.',
    range: (_) => '..',

    rest: (_) => choice('~', '-'),
    elongation: (_) => '_',

    number: (_) => token(/-?(\d+\.?\d*|\.\d+)/),

    // c, eb4, f#3, Bb1, cs2
    note: (_) => token(/[a-gA-G](#|b|s|f)*\d*/),

    // sample, bank, scale and chord names: bd, gm_epiano1, RolandTR909, minor, C^7, Am9
    word: (_) => token(/[A-Za-z_][A-Za-z0-9_#^'\-]*/),
  },
});
