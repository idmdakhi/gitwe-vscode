# Source layout

src/
├── commands/ # one file per VS Code command
├── util/
│ ├── errors.ts
│ └── treeArgs.ts # TreeItem ↔ string helpers
├── webview/
│ └── GitwePanel.ts
├── branchesTreeProvider.ts
├── tagsTreeProvider.ts
├── statusBar.ts
├── gitweClient.ts # Engine factory + settings + workspace helpers
├── gitweModule.ts # dynamic import("gitwe-ts")
├── outputChannel.ts
└── extension.ts # activate / register only
textAll git logic lives in `gitwe-ts`. This package is a thin UI adapter.
