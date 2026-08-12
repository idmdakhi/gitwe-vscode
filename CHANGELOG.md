# Changelog

## 0.2.0

git-flow-parity phases (see `docs/todo.md`):

- **Phase 1** — `Publish` (push -u), `Track` (checkout a remote topic
  branch), `Update` (merge/rebase base into a topic branch), `Checkout
  Base Branch`, `Sync Base Branches`, and a contextual Quick Pick menu
  (`Gitwe: Menu...`, default keybinding `Shift+Alt+G`) with per-branch-type
  submenus driven by the active workflow's configured branch types.
- **Phase 2** — In-editor `Gitwe: Initialize Workflow...` (writes a
  workflow file without a terminal), and tag management (`List Tags`,
  `Push Tag...`, `Delete Tag...`).
- **Phase 3** — A "Tags" sidebar view alongside "Branches". (Version
  bumping and changelog generation on Finish are handled by the `gitwe`
  engine itself via the workflow's `versioning` config — see `gitwe.init`
  — rather than by the extension.)
- Status bar item now opens the contextual menu on click.

## 0.1.0

Initial release.

- Command Palette commands: start, finish, status, graph, doctor, validate,
  show types, open config, pull, push, delete branch, commit info, current
  branch, refresh.
- Sidebar tree view of branch types and their branches.
- Status bar item with current branch and clean/dirty indicator.
- Dashboard webview with live status, branch types, branch graph, and
  quick actions.
- Auto-refresh on external branch changes via a `.git/HEAD` file watcher.
