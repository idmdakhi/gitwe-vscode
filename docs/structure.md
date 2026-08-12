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

src/
│
├── extension.ts
│
├── application/
│ ├── commands/
│ │ ├── start.ts
│ │ ├── finish.ts
│ │ ├── publish.ts
│ │ ├── track.ts
│ │ ├── update.ts
│ │ ├── delete.ts
│ │ ├── checkout.ts
│ │ ├── pull.ts
│ │ ├── push.ts
│ │ ├── tags.ts
│ │ ├── baseBranches.ts
│ │ ├── init.ts
│ │ ├── status.ts
│ │ ├── graph.ts
│ │ ├── doctor.ts
│ │ ├── validate.ts
│ │ └── index.ts
│ │
│ ├── actions/
│ │ ├── refresh.ts
│ │ ├── checkout.ts
│ │ └── finish.ts
│ │
│ └── context/
│ ├── workspace.ts
│ └── branch.ts
│
├── infrastructure/
│ ├── gitwe/
│ │ ├── engine.ts
│ │ ├── module.ts
│ │ ├── resolver.ts
│ │ └── logger.ts
│ │
│ └── vscode/
│ ├── output.ts
│ ├── workspace.ts
│ └── notifications.ts
│
├── presentation/
│ ├── providers/
│ │ ├── branches/
│ │ │ ├── BranchesProvider.ts
│ │ │ ├── BranchTypeItem.ts
│ │ │ ├── BranchItem.ts
│ │ │ └── MessageItem.ts
│ │ │
│ │ ├── tags/
│ │ │ └── TagsProvider.ts
│ │ │
│ │ └── StatusBarProvider.ts
│ │
│ ├── dashboard/
│ │ ├── GitwePanel.ts
│ │ ├── routes.ts
│ │ └── ...
│ │
│ └── graph/
│ └── GraphPanel.ts
│
├── config/
│ ├── settings.ts
│ └── configuration.ts
│
├── shared/
│ ├── errors.ts
│ ├── types.ts
│ └── utils.ts
│
└── index.ts
