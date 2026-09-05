import * as vscode from "vscode";
import { GitweRepo, GitweBranchSummary, GitweNotFoundError } from "./cli";

type Node = TypeGroupNode | BranchNode;

export class TypeGroupNode {
  readonly kind = "type" as const;
  constructor(
    public readonly typeName: string,
    public readonly branches: GitweBranchSummary[],
  ) {}
}

export class BranchNode {
  readonly kind = "branch" as const;
  constructor(
    public readonly branch: GitweBranchSummary,
    public readonly isCurrent: boolean,
  ) {}
}

export class GitweBranchesProvider implements vscode.TreeDataProvider<Node> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<Node | undefined | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private currentBranch: string | undefined;

  constructor(private readonly getRepo: () => GitweRepo | undefined) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if (element.kind === "type") {
      const item = new vscode.TreeItem(element.typeName, vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${element.branches.length}`;
      item.iconPath = new vscode.ThemeIcon("folder");
      item.contextValue = "topicType";
      return item;
    }

    const { branch, isCurrent } = element;
    const item = new vscode.TreeItem(branch.shortName, vscode.TreeItemCollapsibleState.None);
    item.description = isCurrent ? "current" : undefined;
    item.tooltip = branch.branch;
    item.iconPath = new vscode.ThemeIcon(isCurrent ? "target" : "git-branch");
    item.contextValue = "topicBranch";
    item.command = {
      command: "gitwe.branch.checkout",
      title: "Checkout",
      arguments: [element],
    };
    return item;
  }

  async getChildren(element?: Node): Promise<Node[]> {
    const repo = this.getRepo();
    if (!repo) return [];

    if (!element) {
      try {
        const [{ branches }, current] = await Promise.all([repo.list(), repo.current()]);
        this.currentBranch = current.branch ?? undefined;

        const byType = new Map<string, GitweBranchSummary[]>();
        for (const b of branches) {
          const list = byType.get(b.type) ?? [];
          list.push(b);
          byType.set(b.type, list);
        }

        return [...byType.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([typeName, list]) => new TypeGroupNode(typeName, list));
      } catch (err) {
        if (err instanceof GitweNotFoundError) return [];
        throw err;
      }
    }

    if (element.kind === "type") {
      return [...element.branches]
        .sort((a, b) => a.shortName.localeCompare(b.shortName))
        .map((b) => new BranchNode(b, b.branch === this.currentBranch));
    }

    return [];
  }
}
