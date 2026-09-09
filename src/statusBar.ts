import * as vscode from "vscode";
import { GitweRepo, GitweCliError, GitweNotFoundError } from "./cli";
import { formatTarget } from "./util";

export class GitweStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(private readonly getRepo: () => GitweRepo | undefined) {
    this.item = vscode.window.createStatusBarItem("gitwe.status", vscode.StatusBarAlignment.Left, 1);
    this.item.name = "gitwe";
    this.item.command = "gitwe.openDashboard";
  }

  private isEnabled(): boolean {
    return vscode.workspace.getConfiguration("gitwe").get<boolean>("statusBar.enabled", true);
  }

  async refresh(): Promise<void> {
    if (!this.isEnabled()) {
      this.item.hide();
      return;
    }

    const repo = this.getRepo();
    if (!repo) {
      this.item.hide();
      return;
    }

    try {
      const current = await repo.current();
      if (current.detached) {
        this.item.text = "$(git-branch) detached HEAD";
        this.item.tooltip = "gitwe: HEAD is detached";
      } else if (!current.type) {
        this.item.text = `$(git-branch) ${current.branch}`;
        this.item.tooltip = "gitwe: not a configured topic branch — click to open the dashboard";
      } else {
        this.item.text = `$(git-branch) ${current.type}/${current.shortName}`;
        const target = formatTarget(current.target) || "?";
        this.item.tooltip = new vscode.MarkdownString(
          `**gitwe** — \`${current.branch}\`\n\n` + `base: \`${current.base}\`  \ntarget: \`${target}\``,
        );
      }
      this.item.backgroundColor = undefined;
      this.item.show();
    } catch (err) {
      if (err instanceof GitweNotFoundError) {
        this.item.hide();
        return;
      }
      this.item.text = "$(warning) gitwe";
      this.item.tooltip = err instanceof GitweCliError ? err.message : String(err);
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.item.show();
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
