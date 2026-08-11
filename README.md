# Gitwe — Git Workflow Engine for VS Code

Start, finish, and inspect [gitwe](https://github.com/idmdakhi/gitwe)
branching workflows (the `classic` git-flow-style preset, `github` flow,
`gitlab` flow, or your own custom workflow definition) without leaving VS
Code — from the Command Palette, the sidebar, the status bar, or a full
dashboard.

This extension is a thin UI layer over the `gitwe` library — every action
it performs (start, finish, merge, tag, delete) goes through the exact
same domain rules and handlers as the `gitwe` CLI. There's no separate
logic to keep in sync.

## Features

- **Command Palette** — every gitwe operation as a command: `Gitwe: Start
  Branch...`, `Gitwe: Finish Branch...`, `Gitwe: Show Status`, `Gitwe: Show
  Branch Graph`, `Gitwe: Run Doctor`, `Gitwe: Validate Workflow Config...`,
  plus advanced git operations — `Gitwe: Pull`, `Gitwe: Push`, `Gitwe:
  Delete Branch...`, `Gitwe: Show Commit Info...`, `Gitwe: Show Current
  Branch`.
- **Sidebar view** — an activity bar panel listing every configured branch
  type as a group, with its live branches underneath. Click a branch to
  check it out; right-click for Finish / Delete.
- **Status bar** — always-visible current branch and dirty/clean indicator;
  click it to open the dashboard.
- **Dashboard (WebView GUI)** — a single visual panel showing the active
  workflow, working-tree status, every branch type's rules, and a live
  branch graph, with Start / Pull / Push / Doctor buttons.
- Reacts automatically to branch switches made outside the extension
  (terminal `git checkout`, other extensions) by watching `.git/HEAD` and
  `.git/refs/heads`.

## Requirements

- Git installed and available on `PATH`.
- A workspace folder containing a git repository.
- The `gitwe` npm package. It's a declared dependency and is bundled inside
  the packaged `.vsix` (see "Building from source" below for why it isn't
  compiled into `dist/extension.js` like the rest of the extension).

If the repository hasn't been initialized with `gitwe init` yet, the
extension evaluates the `gitwe.workflow` preset in memory so the sidebar,
status bar, and commands work immediately; run **Gitwe: Open Workflow
Config File** or `gitwe init` from a terminal to persist a workflow
definition you can edit.

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitwe.workflow` | `"classic"` | Built-in preset used until a workflow file exists: `classic` (git-flow style) \| `github` (GitHub Flow) \| `gitlab` (GitLab Flow) |
| `gitwe.configPath` | `""` | Path to a custom JSON/YAML workflow config, relative to the workspace folder. Overrides auto-discovery and `gitwe.workflow`. |
| `gitwe.defaultRootBranch` | `"main"` | Root branch used by Status and the branch graph |
| `gitwe.deleteAfterFinish` | `true` | Delete a branch after Finish merges it |
| `gitwe.pushAfterFinish` | `false` | Push to the remote after Finish completes |
| `gitwe.confirmFinish` | `true` | Ask for confirmation before finishing a branch |

## Multi-root workspaces

Commands operate on whichever workspace folder contains the active
editor's file, or the only folder if there's just one.

## Building from source

`gitwe` is published to GitHub Packages, not the public npm registry, so
`npm install` needs a `.npmrc` that points the `gitwe` scope/package there
with a GitHub token that has `read:packages`:

```
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
@idmdakhi:registry=https://npm.pkg.github.com
```

(Adjust the scope/registry line to whatever idmdakhi/gitwe actually
publishes under — check the "Packages" panel on the gitwe repo for the
exact install snippet.)

```bash
npm install
npm run watch    # or: npm run build
npm run package  # produces a .vsix via vsce
```

Press `F5` in VS Code (with this folder open) to launch an Extension
Development Host with the extension loaded.

**Why `gitwe` isn't bundled into `dist/extension.js`:** `gitwe` is pure ESM
and, at runtime, resolves its built-in preset YAML files
(`.gitwe/preset/*.yaml`) relative to its own package directory. Inlining
its compiled output into the extension's single-file bundle would break
that lookup, so `esbuild.js` marks `gitwe` as `external` and the extension
loads it via a dynamic `import()` (the only way a CommonJS-loaded VS Code
extension can load a pure-ESM dependency). `.vscodeignore` is set up to
keep `node_modules/gitwe`, `node_modules/js-yaml`, and
`node_modules/argparse` — but not the rest of `node_modules` — inside the
packaged `.vsix`.

## License

MIT
