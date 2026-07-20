import * as vscode from "vscode";
import { GitweClient } from "../gitwe/client";
import { getConfig } from "../config/settings";

export class StatusBarProvider implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private refreshTimer: NodeJS.Timeout | undefined;

  constructor(private client: GitweClient) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.statusBarItem.command = "gitwe.showStatusMenu";
    this.update();
    this.startAutoRefresh();
  }

  private startAutoRefresh() {
    const config = getConfig();
    const interval = config.refreshInterval || 30000;
    if (interval > 0) {
      this.refreshTimer = setInterval(() => this.update(), interval);
    }
  }

  async update() {
    const config = getConfig();
    if (!config.showStatusBar) {
      this.statusBarItem.hide();
      return;
    }

    try {
      const current = await this.client.getCurrentBranch();
      const branches = await this.client.listBranches();
      const workflow = this.client.workflow.name;

      this.statusBarItem.text = `$(git-branch) ${current}`;
      this.statusBarItem.tooltip = `Gitwe\nWorkflow: ${workflow}\nBranch: ${current}\nTotal: ${branches.length} branches`;
      this.statusBarItem.show();
    } catch (error) {
      this.statusBarItem.text = `$(git-branch) Gitwe`;
      this.statusBarItem.tooltip = "Gitwe: not in a git repository?";
      this.statusBarItem.show();
    }
  }

  dispose() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.statusBarItem.dispose();
  }
}
