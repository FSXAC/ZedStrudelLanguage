# strudel-language-server

A diagnostics-only language server (and CLI linter) for
[Strudel](https://strudel.cc). It tells you whether strudel.cc will accept your
code, without opening the browser.

| Check | How | Runs your code? |
|---|---|---|
| JavaScript syntax | acorn, with Strudel's parser options | no |
| Mini-notation syntax in `"…"` / `` `…` `` | Strudel's own krill parser (`@strudel/mini`) | no |
| Runtime errors (`.gian is not a function`, bad scale names, …) | `@strudel/transpiler` + `@strudel/core` evaluate the code headlessly and query 8 cycles of every pattern | yes, in a separate Node process under `--permission` (no file writes, network APIs, child processes or imports), with a 3s timeout |

Browser-only APIs (audio output, visuals such as `._pianoroll()`, MIDI, Hydra, …)
are stubbed. The list lives in `src/browser-api.json` and is generated from a
Strudel checkout with `npm run gen-browser-api -- /path/to/strudel`.

## Usage

```sh
npm run build
node dist/cli.mjs [--no-eval] file.strudel ...   # CLI linter
node dist/server.mjs --stdio                      # language server
npm test
```

Settings (LSP `initializationOptions` or `workspace/didChangeConfiguration`):

| Key | Default | |
|---|---|---|
| `evaluate` | `true` | Run the runtime check (set `false` to only check syntax) |
| `evaluateDelayMs` | `400` | Debounce after typing |
| `evaluateTimeoutMs` | `3000` | Kill evaluations that run longer than this |

## Publishing

`npm run build && npm publish`. `dist/` is fully bundled, so the package has no
runtime dependencies.

## License

AGPL-3.0-or-later, since it bundles Strudel's AGPL packages.
