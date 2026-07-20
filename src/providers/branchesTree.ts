import * as vscode from "vscode";
import { GitweClient } from "../gitwe/client";

export class BranchesTreeProvider implements vscode.TreeDataProvider<BranchItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    BranchItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private client: GitweClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: BranchItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BranchItem): Promise<BranchItem[]> {
    try {
      const branches = await this.client.listBranches();
      const current = await this.client.getCurrentBranch();

      return branches.map((b) => {
        const item = new BranchItem(
          b.name,
          vscode.TreeItemCollapsibleState.None,
        );
        item.iconPath = b.isCurrent
          ? new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"))
          : new vscode.ThemeIcon("git-branch");
        item.contextValue = "branch";
        item.description = b.isCurrent ? "✓ current" : "";
        item.tooltip = `Branch: ${b.name}`;
        item.command = {
          command: "gitwe.checkout",
          title: "Checkout",
          arguments: [b.name],
        };
        return item;
      });
    } catch (error) {
      return [
        new BranchItem(
          "⚠️ Not in a git repository",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }
  }
}

export class BranchItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
  }
}
