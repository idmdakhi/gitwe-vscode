# Changelog

## 0.2.5

- **Dashboard toolbar now matches the Activity Bar toolbar.** Added a
  "Sync all" button next to "Sync", plus a "More actions" dropdown
  (kebab icon, top right of the header) covering everything else: Checkout,
  Track, Update Current, Pull, Publish Current, Rename Current,
  Delete Current, Validate Workflow, Rebase, Abort, Create Tag, Show
  Branch Graph, Show Workflow Log. Closes on outside click, Escape, or
  after picking an item. Answers "is this on both the Activity Bar and
  the dashboard" - previously it was Activity Bar only.

## 0.2.4

- **New command: Sync All Topic Branches** (`gitwe.syncAll`, runs
  `gitwe sync --all`). Icon: repo-sync.
- **Topic Branches view now has a full toolbar.** Inline icons for Start,
  Sync, Sync All, Doctor, Open Dashboard, Refresh. Everything else the CLI
  supports is one click away in the "..." overflow menu, grouped as:
  - Workflow: Checkout, Track, Update Current, Pull, Publish Current,
    Finish Current, Rename Current, Delete Current
  - Maintenance: Doctor --fix, Validate Workflow, Rebase, Abort,
    Create Tag
  - Insights: Show Branch Graph, Show Workflow Log
    None of this needed new commands (they already existed for the Command
    Palette) except Sync All; this just surfaces them in the view toolbar
    too so you don't have to reach for the Command Palette.

## 0.2.3

- Redesigned the Overview cards in the dashboard webview to be more
  compact: icon moved into a small rounded swatch next to the number
  instead of stacked above it, smaller value/label text, tighter padding,
  and a narrower minimum column width so more cards fit per row.

## 0.2.2

- **Base branches in the Topic Branches view.** A "Base Branches" group
  now appears at the top of the tree, listing every base branch from the
  workflow definition (`main`, `develop`, ...), with the current one
  marked "current". Each row gets two hover icons — **Checkout**
  (`$(arrow-right)`) and **Pull** (`$(cloud-download)`, which checks the
  branch out first if it isn't already current) — also available from the
  right-click context menu.
- **Fixed the `npx` fallback.** It called plain `npx gitwe`, but the
  unscoped `gitwe` package is not actually published on npm (confirmed
  against the registry — 404). It now calls `npx gitwe-ts`, matching the
  install instructions already in this file and the error message shown
  when `gitwe` can't be found.
- Added a Troubleshooting section to the README for two errors people hit
  when `gitwe` itself, not the extension, is out of sync:
  `[CONFIG] remote.name is required` (pre-0.40 `gitwe`, needs an upgrade —
  `remote.name` was renamed to `remote.default`) and
  `Repository is not initialised with gitwe` (missing `.gitwe/gitwe.yaml`
  — run `gitwe init`).

## 0.2.1

- **Sync with gitwe 0.40.x**
  - npx fallback now uses `gitwe` (the published package name) instead of the non-existent `gitwe` package.
  - Install instructions and error messages updated to `npm install -g gitwe-ts` / `@idmdakhi/gitwe`.
  - `package.json` repository URL corrected to point at `gitwe-vscode`.
  - Documented compatibility with gitwe ≥ 0.40 (RFC-0004 JSON envelope).

## 0.2.0

- **Dashboard redesign** — complete visual overhaul guided by [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
  - Dark Mode (OLED) developer-tool palette with VS Code theme fallbacks
  - IBM Plex Sans + JetBrains Mono typography
  - Stat cards with accent bar + soft icons
  - Color-coded branch type badges (feature / hotfix / release / chore)
  - SVG icons throughout (no emoji)
  - Subtle stagger animations (respects reduced-motion)
  - Improved empty states, doctor findings, and hover affordances
  - Responsive layout for narrow webview widths

## 0.1.0

Initial release:

- Status bar current-topic indicator.
- Topic Branches Activity Bar view with inline actions.
- Dashboard webview (overview, doctor findings, branch list).
- Command Palette commands for every relevant `gitwe` subcommand.
- Configurable binary resolution (`PATH` → `npx gitwe` → `gitwe.binaryPath`).
