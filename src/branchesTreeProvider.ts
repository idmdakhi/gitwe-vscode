import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "./gitweClient";
import { showGitweError } from "./util/errors";

export class BranchTypeItem extends vscode.TreeItem {
  constructor(
    public readonly typeName: string,
    public readonly prefix: string,
    public readonly baseBranch: string,
    public readonly mergeTargets: readonly string[],
  ) {
    super(typeName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${prefix} → ${mergeTargets.join(", ") || "(none)"}`;
    this.iconPath = new vscode.ThemeIcon("folder");
    this.contextValue = "gitweBranchType";
    this.tooltip = new vscode.MarkdownString(
      `**${typeName}**\n\nPrefix: \`${prefix}\`\n\nBase branch: \`${baseBranch}\`\n\nMerges into: ${
        mergeTargets.map((t) => `\`${t}\``).join(", ") || "(none)"
      }`,
    );
  }
}

export class BranchItem extends vscode.TreeItem {
  constructor(
    public readonly branchName: string,
    isCurrent: boolean,
  ) {
    super(branchName, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(isCurrent ? "check" : "git-branch");
    this.contextValue = "gitweBranch";
    this.description = isCurrent ? "current" : undefined;
    this.command = { command: "gitwe.checkoutBranch", title: "Checkout", arguments: [branchName] };
  }
}

class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

type GitweTreeItem = BranchTypeItem | BranchItem | MessageItem;

export class GitweBranchesProvider implements vscode.TreeDataProvider<GitweTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<GitweTreeItem | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  getTreeItem(element: GitweTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GitweTreeItem): Promise<GitweTreeItem[]> {
    const folder = pickWorkspaceFolder();
    if (!folder) return [new MessageItem("Open a folder with a git repository.")];

    try {
      const engine = await getEngine(folder, this.outputChannel);

      if (!element) {
        return engine.workflow.branchTypes.map(
          (type) => new BranchTypeItem(type.name, type.prefix, type.base, type.target),
        );
      }

      if (element instanceof BranchTypeItem) {
        const statuses = await engine.listBranchTypes(engine.workflow.requireBranchType(element.typeName));
        return statuses.length > 0
          ? statuses.map((b) => new BranchItem(b.name, b.current))
          : [new MessageItem("No branches of this type yet.")];
      }

      return [];
    } catch (error) {
      await showGitweError(error, this.outputChannel);
      return [new MessageItem("Failed to load — see the Gitwe output channel.")];
    }
  }
}
