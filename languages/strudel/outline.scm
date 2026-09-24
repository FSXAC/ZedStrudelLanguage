; Each Strudel pattern block (`$:`, `bass:`, `d1:` ...) shows up in the outline.
(labeled_statement
  label: (statement_identifier) @name) @item

(lexical_declaration
  (variable_declarator
    name: (identifier) @name)) @item

(variable_declaration
  (variable_declarator
    name: (identifier) @name)) @item

(function_declaration
  "function" @context
  name: (identifier) @name) @item
