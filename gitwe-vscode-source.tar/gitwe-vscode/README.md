# gitwe for VS Code

Run and visualize your [gitwe](https://github.com/idmdakhi/gitwe) branching
workflow — `start`, `finish`, `update`, `sync`, `publish`, `doctor`, and more —
without leaving the editor.

gitwe is a configurable git branching-workflow engine (git-flow/GitHub
Flow/GitLab Flow are just presets on top of it). This extension is a thin,
transparent client around the `gitwe` CLI: every action here maps 1:1 to a
documented `gitwe` command run with `--format json`, so nothing happens that
you couldn't reproduce yourself on the command line.

## Features

- **Status bar** — shows the resolved type/short name of the branch you're
  on (e.g. `feature/login`), or a warning if `gitwe doctor` finds a problem.
  Click it to open the dashboard.
- **Topic Branches view** (Activity Bar) — every topic branch, grouped by
  type, with inline actions: checkout, update, publish, finish, rename,
  delete.
- **Dashboard** (`gitwe: Open Dashboard`) — one webview with the workflow
  overview, `gitwe doctor` findings, and the full branch list with quick
  actions.
- **Command Palette** — every `gitwe` subcommand that makes sense outside a
  terminal: `init`, `start`, `finish`, `update`, `sync`, `pull`, `publish`,
  `delete`, `rename`, `checkout`, `track`, `tag`, `rebase`, `abort`,
  `doctor`, `doctor --fix`, `validate`, `graph`, `log`.
- Merge conflicts surfaced from `finish`/`update` offer **Show Files** and
  **Abort** actions instead of a raw stack trace.

## Requirements

- [gitwe](https://github.com/idmdakhi/gitwe) itself: `npm install -g gitwe`
  (or leave it uninstalled and let the extension fall back to `npx gitwe`).
- A repository with a workflow definition (`.gitwe/gitwe.yaml`) — the
  Topic Branches view offers to run `gitwe init` if one isn't found.
- Node.js ≥ 20 and `git` on `PATH` (gitwe's own requirements).

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `gitwe.binaryPath` | `""` | Explicit path to the `gitwe` executable. |
| `gitwe.useNpxFallback` | `true` | Use `npx gitwe` when no global install is found. |
| `gitwe.confirmDestructiveActions` | `true` | Confirm before delete / force-finish / abort. |
| `gitwe.statusBar.enabled` | `true` | Show the current topic branch in the status bar. |
| `gitwe.runInTerminal` | `false` | Reserved for a future terminal-transcript mode. |

## Development

```bash
npm install
npm run watch     # esbuild --watch
# press F5 in VS Code to launch an Extension Development Host
```

```bash
npm run typecheck # tsc --noEmit
npm run build     # production bundle to dist/extension.js
npm run package   # vsce package -> .vsix
```

## Design notes

The dashboard's visual style (dark developer-tool palette, JetBrains
Mono for branch names, accessible contrast, no emoji-as-icons) follows the
`ui-ux-pro-max` design-system guidance for coding tools, layered on top of
VS Code's own theme variables so it still adapts to light themes.

## License

MIT
