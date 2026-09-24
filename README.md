# Strudel for Zed

Syntax highlighting for [Strudel](https://strudel.cc) — the JavaScript live-coding
music environment — in the [Zed](https://zed.dev) editor.

Strudel code is JavaScript, so this extension reuses
[tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript)
and adds Strudel-aware queries on top.

## Features

- Registers the **Strudel** language for `*.strudel` and `*.str` files
- Pattern labels (`$:`, `d1:`, `bass:`) highlighted bold (via
  `@emphasis.strong`, falling back to `@label`); muted patterns (`_$:`,
  `_bass:`) highlighted as comments
- Full **mini-notation** highlighting inside `"..."` and `` `...` `` strings
  (plain `'...'` strings are left alone, matching how Strudel parses them):
  notes, sample/scale names, numbers, rests, operators (`* / @ ! ? : ..`),
  and `[ ] < > { } ( )` groups, powered by a bundled tree-sitter grammar in
  [`tree-sitter-strudel-mini/`](tree-sitter-strudel-mini)
- Pattern constructors / globals (`s`, `sound`, `note`, `n`, `stack`, `cat`,
  `setcpm`, `samples`, …) highlighted as builtins
- Continuous signals (`sine`, `saw`, `rand`, `perlin`, …) highlighted as
  builtin constants
- Visual methods (`._pianoroll()`, `._scope()`, `._punchcard()`, …)
  highlighted specially
- Outline panel lists every pattern block and top-level variable
- Bracket matching, auto-closing, auto-indent and `cmd-/` comment toggling

## Install locally (dev extension)

1. Open Zed, run `zed: install dev extension` from the command palette
   (`cmd-shift-p`), or click **Install Dev Extension** on the Extensions page
   (`cmd-shift-x`).
2. Select this directory.
3. Open any `.strudel` file (e.g. [`test/festival-edm.strudel`](test/festival-edm.strudel)).

Zed downloads the grammar at the pinned `rev` and compiles it to WASM (it
fetches `wasi-sdk` automatically the first time). After editing queries, click
**Rebuild** on the extension in the Extensions page. Use `zed: open log` or
launch with `zed --foreground` to debug load errors.

To tweak label styling, override `emphasis.strong` (or `label`) in your
settings via `theme_overrides`, e.g.
`{ "theme_overrides": { "One Dark": { "syntax": { "emphasis.strong": { "color": "#e06c75", "font_weight": 800 } } } } }`
(note this also affects bold Markdown text).

To open files with other extensions as Strudel, add to your Zed settings:

```json
{ "file_types": { "Strudel": ["*.strudel.js"] } }
```

## Project layout

```
extension.toml               # manifest + pinned tree-sitter-javascript grammar
languages/strudel/
  config.toml                # language metadata (suffixes, comments, brackets)
  highlights.scm             # syntax highlighting
  brackets.scm indents.scm outline.scm overrides.scm
  injections.scm             # injects mini-notation into "..." / `...` strings
languages/strudel-mini/      # hidden "Strudel Mini" language (injection target)
tree-sitter-strudel-mini/    # mini-notation grammar (grammar.js + generated src/)
test/                        # sample Strudel files for manual testing
```

### Working on the mini-notation grammar

Edit `tree-sitter-strudel-mini/grammar.js`, then (with the
[tree-sitter CLI](https://github.com/tree-sitter/tree-sitter/releases)):

```sh
cd tree-sitter-strudel-mini
tree-sitter generate --js-runtime native   # regenerates src/
tree-sitter test                           # runs test/corpus/*.txt
```

Commit the result, set `rev` under `[grammars.strudel_mini]` in
`extension.toml` to that commit, and rebuild the dev extension in Zed.

## Publishing

See Zed's [publishing guide](https://zed.dev/docs/extensions/publishing/overview).
In short:

1. Push this repo publicly to GitHub (the `repository` field in
   `extension.toml` must match) and make sure `LICENSE` is present (MIT).
   Change `[grammars.strudel_mini] repository` from the local `file://` URL to
   `https://github.com/FSXAC/ZedStrudelLanguage`; its `rev` must be a pushed
   commit.
2. Fork [`zed-industries/extensions`](https://github.com/zed-industries/extensions)
   (to a personal account) and clone it with submodules.
3. Add this repo as a submodule and register it:

   ```sh
   git submodule add https://github.com/FSXAC/ZedStrudelLanguage.git extensions/strudel
   ```

   ```toml
   # extensions.toml
   [strudel]
   submodule = "extensions/strudel"
   version = "0.1.0"
   ```

4. Run `pnpm sort-extensions`, commit, and open a PR (one extension per PR).

To ship updates: bump `version` in `extension.toml`, push, then open a PR to
`zed-industries/extensions` that bumps the submodule commit and the `version`
in `extensions.toml`.

## License

MIT
