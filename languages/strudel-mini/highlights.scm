(note) @constant
(word) @string
(number) @number

[
  (rest)
  (elongation)
] @comment

(modifier operator: _ @operator)
(range) @operator

[
  (stack_separator)
  (choice_separator)
  (group_separator)
] @punctuation.delimiter

["[" "]" "{" "}" "(" ")"] @punctuation.bracket
["<" ">"] @punctuation.special
