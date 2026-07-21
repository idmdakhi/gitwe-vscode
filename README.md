# Gitwe — Git Workflow Engine for VS Code

Start, finish, and inspect [gitwe](https://github.com/Git-Workflow-Engine/gitwe)
branching workflows (git-flow, GitHub Flow, trunk-based, or your own custom
one) without leaving VS Code — from the Command Palette, the sidebar, the
status bar, or a full dashboard.

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
- The `gitwe` npm package (declared as a dependency; installed automatically
  when you install this extension from a `.vsix` that bundles it, or via
  `npm install` if you're building from source).

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitwe.workflow` | `"git-flow"` | Built-in workflow: `git-flow` \| `github-flow` \| `trunk-based` |
| `gitwe.configPath` | `""` | Path to a custom JSON/YAML workflow config, relative to the workspace folder. Overrides `gitwe.workflow`. |
| `gitwe.defaultRootBranch` | `"main"` | Root branch used by Status and the branch graph |
| `gitwe.deleteAfterFinish` | `true` | Delete a branch after Finish merges it |
| `gitwe.pushAfterFinish` | `false` | Push to the remote after Finish completes |
| `gitwe.confirmFinish` | `true` | Ask for confirmation before finishing a branch |

## Multi-root workspaces

Commands operate on whichever workspace folder contains the active
editor's file, or the only folder if there's just one.

## Building from source

```bash
npm install
npm run watch    # or: npm run build
```

Press `F5` in VS Code (with this folder open) to launch an Extension
Development Host with the extension loaded.

## License

MIT
