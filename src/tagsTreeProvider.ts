import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "./gitweClient";
import { showGitweError } from "./util/errors";

export class TagItem extends vscode.TreeItem {
  constructor(public readonly tagName: string) {
    super(tagName, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("tag");
    this.contextValue = "gitweTag";
  }
}
class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

/** Sidebar view listing every git tag — the "separate SCM view for versions/tags" from the roadmap. */
export class GitweTagsProvider implements vscode.TreeDataProvider<
  TagItem | MessageItem
> {
  private readonly changeEmitter = new vscode.EventEmitter<
    TagItem | MessageItem | undefined
  >();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  getTreeItem(element: TagItem | MessageItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<(TagItem | MessageItem)[]> {
    const folder = pickWorkspaceFolder();
    if (!folder)
      return [new MessageItem("Open a folder with a git repository.")];

    try {
      const engine = await getEngine(folder, this.outputChannel);
      const tags = await engine.git.tags();
      if (tags.length === 0) return [new MessageItem("No tags yet.")];
      // Newest first, best-effort (tags() is generally chronological/lexicographic from git).
      return [...tags].reverse().map((tag) => new TagItem(tag));
    } catch (error) {
      await showGitweError(error, this.outputChannel);
      return [
        new MessageItem("Failed to load — see the Gitwe output channel."),
      ];
    }
  }
}
