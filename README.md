# Strudel for Zed

Syntax highlighting for [Strudel](https://strudel.cc) — the JavaScript live-coding
music environment — in the [Zed](https://zed.dev) editor.

Strudel code is JavaScript, so this extension reuses
[tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript)
and adds Strudel-aware queries on top.

## Features

- Registers the **Strudel** language for `*.strudel` and `*.str` files
- Pattern labels (`$:`, `d1:`, `bass:`) highlighted as labels; muted
  patterns (`_$:`, `_bass:`) highlighted as comments
- Mini-notation strings (`"..."` and `` `...` ``) are highlighted differently
  from plain JS strings (`'...'`), matching how Strudel parses them
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
test/                        # sample Strudel files for manual testing
```

## Publishing

See Zed's [publishing guide](https://zed.dev/docs/extensions/publishing/overview).
In short:

1. Push this repo publicly to GitHub (the `repository` field in
   `extension.toml` must match) and make sure `LICENSE` is present (MIT).
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
