import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "./gitweClient";
import { showGitweError } from "./util/errors";
import { iconForBranchType } from "./util/branchIcons";
import { capabilitiesForType, branchContextValue } from "./util/capabilities";

export class BranchTypeItem extends vscode.TreeItem {
  constructor(
    public readonly typeName: string,
    public readonly prefix: string,
    public readonly baseBranch: string,
    public readonly mergeTargets: readonly string[],
  ) {
    super(typeName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${prefix} → ${mergeTargets.join(", ") || "(none)"}`;
    this.iconPath = iconForBranchType(typeName); // آیکون جدید
    this.contextValue = "gitweBranchType";
    this.tooltip = new vscode.MarkdownString(
      `**${typeName}**\n\nPrefix: \`${prefix}\`\n\nBase: \`${baseBranch}\`\n\nMerges into: ${mergeTargets.map((t) => `\`${t}\``).join(", ") || "(none)"}`,
    );
  }
}

export class BranchGroupItem extends vscode.TreeItem {
  constructor(
    public readonly group: "local" | "remote",
    public readonly typeName: string,
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
    this.contextValue = branchContextValue(
      capabilitiesForType(typeName ?? "feature", hasTargets),
      isRemote,
    );
    this.description = isCurrent
      ? "● current"
      : isRemote
        ? "origin"
        : undefined;

    // description
    if (isCurrent) {
      this.description = "● current";
    } else if (isRemote) {
      this.description = "origin";
    }

    // tooltip
    this.tooltip = new vscode.MarkdownString(
      isRemote
        ? `**Remote** \`${branchName}\`\n\nTrack to create a local branch.`
        : `**${branchName}**${isCurrent ? " _(current)_" : ""}\n\nClick to check out · right-click for actions.`,
    );
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

      if (!element) {
        return engine.workflow.branchTypes.map(
          (type) =>
            new BranchTypeItem(type.name, type.prefix, type.base, type.target),
        );
      }

      if (element instanceof BranchTypeItem) {
        const caps = capabilitiesForType(
          element.typeName,
          element.mergeTargets.length > 0,
        );
        return [
          new BranchGroupItem("local", element.typeName),
          new BranchGroupItem("remote", element.typeName),
        ];
      }

      if (element instanceof BranchGroupItem && element.group === "local") {
        const type = engine.workflow.requireBranchType(element.typeName);
        const hasTargets = type.target.length > 0;
        const statuses = await engine.listBranchTypes(type);
        return statuses.length > 0
          ? statuses.map(
              (b) =>
                new BranchItem(b.name, b.current, false, type.name, hasTargets),
            )
          : [
              new MessageItem(
                "No local branches yet — right-click type to start.",
              ),
            ];
      }

      if (element instanceof BranchGroupItem && element.group === "remote") {
        const remote = engine.workflow.remoteName;
        await engine.git.fetch(remote).catch(() => {});
        const allRemote = await engine.git.listRemoteBranches(remote);
        const type = engine.workflow.requireBranchType(element.typeName);
        const local = await engine.listBranchTypes(type);
        const localNames = new Set(local.map((b) => b.name));
        const onlyRemote = allRemote.filter(
          (b) => b.startsWith(type.prefix) && !localNames.has(b),
        );

        return onlyRemote.length > 0
          ? onlyRemote.map(
              (name) => new BranchItem(name, false, true, type.name, true),
            )
          : [new MessageItem("No remote-only branches.")];
      }

      return [];
    } catch (error) {
      await showGitweError(error, this.outputChannel);
      return [new MessageItem("Failed to load — see Gitwe output channel.")];
    }
  }
}
