import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "./gitweClient";
import { showGitweError } from "./util/errors";
import { branchContextValue, capabilitiesForType } from "./util/capabilities";

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

/** Group header: "Local" or "Remote". */
export class BranchGroupItem extends vscode.TreeItem {
  constructor(
    public readonly group: "local" | "remote",
    public readonly typeName: string,
    public readonly prefix: string,
  ) {
    super(
      group === "local" ? "Local" : "Remote",
      vscode.TreeItemCollapsibleState.Expanded,
    );
    this.iconPath = new vscode.ThemeIcon(group === "local" ? "home" : "cloud");
    this.contextValue =
      group === "local" ? "gitweLocalGroup" : "gitweRemoteGroup";
    this.description = typeName;
  }
}

export class BranchItem extends vscode.TreeItem {
  constructor(
    public readonly branchName: string,
    isCurrent: boolean,
    public readonly isRemote = false,
    typeName?: string,
    hasTargets = true,
  ) {
    super(branchName, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(
      isRemote ? "cloud" : isCurrent ? "check" : "git-branch",
    );

    const caps = capabilitiesForType(typeName ?? "feature", hasTargets);
    this.contextValue = branchContextValue(caps, isRemote);
    this.description = isCurrent ? "current" : isRemote ? "remote" : undefined;

    if (!isRemote) {
      this.command = {
        command: "gitwe.checkoutBranch",
        title: "Checkout",
        arguments: [branchName],
      };
    }
  }
}

class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

type GitweTreeItem =
  | BranchTypeItem
  | BranchGroupItem
  | BranchItem
  | MessageItem;

export class GitweBranchesProvider implements vscode.TreeDataProvider<GitweTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<
    GitweTreeItem | undefined
  >();
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
    if (!folder)
      return [new MessageItem("Open a folder with a git repository.")];

    try {
      const engine = await getEngine(folder, this.outputChannel);

      // Root: branch types
      if (!element) {
        return engine.workflow.branchTypes.map(
          (type) =>
            new BranchTypeItem(type.name, type.prefix, type.base, type.target),
        );
      }

      // Under a branch type → Local + Remote groups
      if (element instanceof BranchTypeItem) {
        return [
          new BranchGroupItem("local", element.typeName, element.prefix),
          new BranchGroupItem("remote", element.typeName, element.prefix),
        ];
      }

      // Under Local group → local topic branches
      if (element instanceof BranchGroupItem && element.group === "local") {
        // Local group
        const type = engine.workflow.requireBranchType(element.typeName);
        const hasTargets = type.target.length > 0;
        const statuses = await engine.listBranchTypes(type);
        return statuses.length > 0
          ? statuses.map(
              (b) =>
                new BranchItem(b.name, b.current, false, type.name, hasTargets),
            )
          : [new MessageItem("No local branches of this type.")];
      }

      // Under Remote group → remote branches matching prefix
      if (element instanceof BranchGroupItem && element.group === "remote") {
        const remote = engine.workflow.remoteName;
        try {
          await engine.git.fetch(remote);
        } catch {
          // fetch may fail offline — still try listing cached remotes
        }
        const allRemote = await engine.git.listRemoteBranches(remote);
        const matching = allRemote.filter((b) => b.startsWith(element.prefix));
        // Skip ones that already have a local branch of the same name
        const type = engine.workflow.requireBranchType(element.typeName);
        const local = await engine.listBranchTypes(type);
        const localNames = new Set(local.map((b) => b.name));
        const onlyRemote = matching.filter((b) => !localNames.has(b));

        // Remote group
        return onlyRemote.length > 0
          ? onlyRemote.map(
              (name) =>
                new BranchItem(name, false, true, element.typeName, true),
            )
          : [new MessageItem("No remote-only branches.")];
      }

      return [];
    } catch (error) {
      await showGitweError(error, this.outputChannel);
      return [
        new MessageItem("Failed to load — see the Gitwe output channel."),
      ];
    }
  }
}
