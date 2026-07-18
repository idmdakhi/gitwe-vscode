// vscode-extension/src/providers/BranchTreeProvider.ts
import * as vscode from "vscode";
import { getGitRoot, createEngine } from "../utils";

export class BranchTreeProvider implements vscode.TreeDataProvider<BranchItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    BranchItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BranchItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BranchItem): Promise<BranchItem[]> {
    const root = getGitRoot();
    if (!root) return [];

    const engine = createEngine(root);
    const branches = await engine.listBranches();
    const current = await engine.currentBranch();

    // ساخت درخت با استفاده از getBranchParent
    const parentMap = new Map<string, string>();
    // ... (همان منطق buildTree از نسخه‌ی CLI)

    // تبدیل به BranchItem
    return branches.map((b) => {
      const item = new BranchItem(
        b.name,
        b.isCurrent
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = b.isCurrent
        ? new vscode.ThemeIcon("git-branch")
        : new vscode.ThemeIcon(
            "git-branch",
            new vscode.ThemeColor("editorLineNumber.foreground"),
          );
      item.description = b.isCurrent ? "current" : "";
      return item;
    });
  }
}

export class BranchItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.tooltip = this.label;
  }
}
