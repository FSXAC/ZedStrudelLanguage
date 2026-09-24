; Strudel syntax highlighting, built on tree-sitter-javascript.
; Later patterns take precedence over earlier ones.

; ---------------------------------------------------------------------------
; JavaScript base
; ---------------------------------------------------------------------------

(identifier) @variable

(property_identifier) @property
(shorthand_property_identifier) @property
(shorthand_property_identifier_pattern) @variable

(formal_parameters (identifier) @variable.parameter)
(arrow_function parameter: (identifier) @variable.parameter)

(function_declaration name: (identifier) @function)
(function_expression name: (identifier) @function)
(method_definition name: (property_identifier) @function.method)

(variable_declarator
  name: (identifier) @function
  value: [(function_expression) (arrow_function)])

(call_expression function: (identifier) @function)
(call_expression
  function: (member_expression property: (property_identifier) @function.method))

(new_expression constructor: (identifier) @constructor)

((identifier) @constant
  (#match? @constant "^[A-Z][A-Z0-9_]+$"))

[
  (this)
  (super)
] @variable.special

[
  (true)
  (false)
] @boolean

[
  (null)
  (undefined)
] @constant.builtin

(number) @number
(regex) @string.regex
(escape_sequence) @string.escape

(comment) @comment

; Single-quoted strings are plain JavaScript strings in Strudel.
(string) @string

; Double-quoted and backtick strings are parsed as mini-notation by Strudel.
((string) @string.special
  (#match? @string.special "^\""))
(template_string) @string.special

(template_substitution
  "${" @punctuation.special
  "}" @punctuation.special) @embedded

[
  "as" "async" "await" "break" "case" "catch" "class" "const" "continue"
  "debugger" "default" "delete" "do" "else" "export" "extends" "finally"
  "for" "from" "function" "get" "if" "import" "in" "instanceof" "let" "new"
  "of" "return" "set" "static" "switch" "target" "throw" "try" "typeof" "var"
  "void" "while" "with" "yield"
] @keyword

[
  "-" "--" "-=" "+" "++" "+=" "*" "*=" "**" "**=" "/" "/=" "%" "%=" "<" "<="
  "<<" "<<=" "=" "==" "===" "!" "!=" "!==" "=>" ">" ">=" ">>" ">>=" ">>>"
  ">>>=" "~" "^" "&" "|" "^=" "&=" "|=" "&&" "||" "??" "&&=" "||=" "??="
  "..." "?"
] @operator

(ternary_expression [":" "?"] @operator)

["(" ")" "[" "]" "{" "}"] @punctuation.bracket
[";" "," "." (optional_chain)] @punctuation.delimiter

; ---------------------------------------------------------------------------
; Strudel
; ---------------------------------------------------------------------------

; Pattern labels: `$:`, `d1:`, `bass:`, `$lead:`
; `@emphasis.strong` renders bold in most themes; falls back to `@label`.
(labeled_statement
  label: (statement_identifier) @label @emphasis.strong
  ":" @label @emphasis.strong)

; Muted patterns: `_$:`, `_bass:`
(labeled_statement
  label: (statement_identifier) @comment
  ":" @comment.muted
  (#match? @comment "^_"))

; Pattern constructors, globals and helpers
((call_expression
  function: (identifier) @function.builtin)
  (#any-of? @function.builtin
    ; sources
    "s" "sound" "note" "n" "freq" "chord" "vowel" "m" "mini" "pure"
    "reify" "sequence" "seq" "cat" "fastcat" "slowcat" "stack" "polymeter"
    "polymeterSteps" "arrange" "timeCat" "timecat" "stepcat" "silence"
    "run" "binary" "binaryN" "irand" "choose" "chooseCycles" "randcat"
    "wchoose" "wchooseCycles" "wrandcat" "mask" "struct"
    ; setup / transport
    "setcpm" "setcps" "setCpm" "setCps" "samples" "hush" "loadOrc"
    "initAudioOnFirstClick" "setDefaultVoicings" "addVoicings" "register"
    "aliasBank" "soundAlias" "slider" "useRNG"
    ; math
    "add" "sub" "mul" "div"))

; Visual feedback: `._pianoroll()`, `._scope()`, `.punchcard()` ...
((call_expression
  function: (member_expression
    property: (property_identifier) @function.special))
  (#match? @function.special "^_?(pianoroll|punchcard|scope|tscope|fscope|spiral|spectrum|pitchwheel|wordfall|markcss|color|colour)$"))

; Continuous signals
((identifier) @constant.builtin
  (#any-of? @constant.builtin
    "saw" "saw2" "isaw" "isaw2" "sine" "sine2" "cosine" "cosine2"
    "square" "square2" "tri" "tri2" "itri" "itri2" "rand" "rand2" "perlin"
    "brand" "time" "mouseX" "mouseY"))
