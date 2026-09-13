import * as vscode from "vscode";
import { GitweRepo, GitweBranchSummary, GitweNotFoundError } from "./cli";

type Node = BaseGroupNode | BaseBranchNode | TypeGroupNode | BranchNode;

export class BaseGroupNode {
  readonly kind = "baseGroup" as const;
  constructor(public readonly branches: string[]) {}
}

export class BaseBranchNode {
  readonly kind = "base" as const;
  constructor(
    public readonly name: string,
    public readonly isCurrent: boolean,
  ) {}
}

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
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    Node | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private currentBranch: string | undefined;

  constructor(private readonly getRepo: () => GitweRepo | undefined) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if (element.kind === "baseGroup") {
      const item = new vscode.TreeItem(
        "Base Branches",
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.description = `${element.branches.length}`;
      item.iconPath = new vscode.ThemeIcon("repo");
      item.contextValue = "baseGroup";
      return item;
    }

    if (element.kind === "base") {
      const { name, isCurrent } = element;
      const item = new vscode.TreeItem(
        name,
        vscode.TreeItemCollapsibleState.None,
      );
      item.description = isCurrent ? "current" : undefined;
      item.tooltip = `${name}  ·  base branch`;
      item.iconPath = new vscode.ThemeIcon(isCurrent ? "target" : "git-branch");
      item.contextValue = "baseBranch";
      item.command = {
        command: "gitwe.checkoutBranchByName",
        title: "Checkout",
        arguments: [name],
      };
      return item;
    }

    if (element.kind === "type") {
      const item = new vscode.TreeItem(
        element.typeName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.description = `${element.branches.length}`;
      item.iconPath = new vscode.ThemeIcon("folder");
      item.contextValue = "topicType";
      return item;
    }

    const { branch, isCurrent } = element;
    const item = new vscode.TreeItem(
      branch.shortName,
      vscode.TreeItemCollapsibleState.None,
    );
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
        const [{ branches }, current, overview] = await Promise.all([
          repo.list(),
          repo.current(),
          repo.overview(),
        ]);
        this.currentBranch = current.branch ?? undefined;

        const byType = new Map<string, GitweBranchSummary[]>();
        for (const b of branches) {
          const list = byType.get(b.type) ?? [];
          list.push(b);
          byType.set(b.type, list);
        }

        const typeGroups = [...byType.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([typeName, list]) => new TypeGroupNode(typeName, list));

        const baseGroup = overview.baseBranches.length
          ? [new BaseGroupNode([...overview.baseBranches])]
          : [];

        return [...baseGroup, ...typeGroups];
      } catch (err) {
        if (err instanceof GitweNotFoundError) return [];
        throw err;
      }
    }

    if (element.kind === "baseGroup") {
      return element.branches.map(
        (name) => new BaseBranchNode(name, name === this.currentBranch),
      );
    }

    if (element.kind === "type") {
      return [...element.branches]
        .sort((a, b) => a.shortName.localeCompare(b.shortName))
        .map((b) => new BranchNode(b, b.branch === this.currentBranch));
    }

    return [];
  }
}
