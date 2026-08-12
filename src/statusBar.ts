import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "./gitweClient";

export class GitweStatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor(private readonly outputChannel: vscode.OutputChannel) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
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
      const [branch, clean] = await Promise.all([
        engine.git.currentBranch(),
        engine.git.isClean(),
      ]);

      const workflow = engine.workflow.config.name;
      const short = branch ?? "detached";
      const typeHint = branch
        ? ` _( ${engine.workflow.resolveBranch(branch)?.type.name ?? ""} )_`
        : "";

      const dirty = clean ? "" : " •";

      this.item.text = `$(git-branch) ${short}${dirty}`;
      this.item.backgroundColor = clean
        ? undefined
        : new vscode.ThemeColor("statusBarItem.warningBackground");

      this.item.tooltip = new vscode.MarkdownString(
        [
          `**Gitwe** \`${workflow}\``,
          `Branch: \`${short}\`${typeHint}`,
          `Working tree: ${clean ? "clean" : "**uncommitted changes**"}`,
          `_Click to open menu · Shift+Alt+G_`,
          ``,
        ].join("\n"),
      );
      this.item.show();
    } catch {
      this.item.text = "$(git-branch) Gitwe";
      this.item.backgroundColor = undefined;
      this.item.tooltip = "Open a git repository to use Gitwe.";
      this.item.show();
    }
  }
}
