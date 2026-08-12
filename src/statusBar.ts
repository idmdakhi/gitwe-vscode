import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "./gitweClient";

export class GitweStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor(private readonly outputChannel: vscode.OutputChannel) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "gitwe.menu";
    this.item.name = "Gitwe";
  }

  show(): void {
    this.item.show();
    void this.refresh();
  }

  dispose(): void {
    this.item.dispose();
  }

  async refresh(): Promise<void> {
    const folder = pickWorkspaceFolder();
    if (!folder) {
      this.item.hide();
      return;
    }

    try {
      const engine = await getEngine(folder, this.outputChannel);
      const [branch, clean] = await Promise.all([engine.git.currentBranch(), engine.git.isClean()]);
      const dirtyMarker = clean ? "" : " $(circle-filled)";
      this.item.text = `$(git-branch) ${branch ?? "detached"}${dirtyMarker}`;
      this.item.tooltip = new vscode.MarkdownString(
        `**Gitwe** — workflow: \`${engine.workflow.config.name}\`\n\n` +
          `Current branch: \`${branch ?? "(detached HEAD)"}\`\n\n` +
          `Working tree: ${clean ? "clean" : "has uncommitted changes"}\n\n` +
          `Click to open the Gitwe menu.`,
      );
      this.item.show();
    } catch {
      this.item.text = "$(git-branch) gitwe: not a repo";
      this.item.tooltip = "Open a folder with a git repository to use Gitwe.";
      this.item.show();
    }
  }
}
