; Strudel parses double-quoted and backtick strings as mini-notation.
(string
  "\""
  (string_fragment) @injection.content
  (#set! injection.language "Strudel Mini"))

(template_string
  (string_fragment) @injection.content
  (#set! injection.language "Strudel Mini"))
