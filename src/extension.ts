import * as vscode from "vscode";
import { GitweBranchesProvider } from "./branchesTreeProvider";
import { GitweStatusBar } from "./statusBar";
import { GitwePanel } from "./webview/GitwePanel";
import { startBranchCommand } from "./commands/start";
import { finishBranchCommand } from "./commands/finish";
import { showStatusCommand } from "./commands/status";
import { showGraphCommand } from "./commands/graph";
import { runDoctorCommand } from "./commands/doctor";
import { validateWorkflowCommand } from "./commands/validate";
import { showTypesCommand } from "./commands/showTypes";
import { openConfigCommand } from "./commands/openConfig";
import { checkoutBranchCommand } from "./commands/checkoutBranch";
import { deleteBranchCommand } from "./commands/deleteBranch";
import { pullCommand, pushCommand } from "./commands/pullPush";
import { showCommitInfoCommand } from "./commands/commitInfo";
import { showCurrentBranchCommand } from "./commands/currentBranch";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Gitwe");
  context.subscriptions.push(outputChannel);

  const branchesProvider = new GitweBranchesProvider(outputChannel);
  const treeView = vscode.window.createTreeView("gitweBranches", { treeDataProvider: branchesProvider });
  context.subscriptions.push(treeView);

  const statusBar = new GitweStatusBar(outputChannel);
  context.subscriptions.push(statusBar);
  statusBar.show();

  const refreshAll = (): void => {
    branchesProvider.refresh();
    void statusBar.refresh();
  };

  // Keep the sidebar/status bar in sync with branch switches, merges, etc. made outside the extension
  // (terminal `git checkout`, other extensions, ...) by watching .git/HEAD and the refs directory.
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, ".git/{HEAD,refs/heads/**}"),
      );
      watcher.onDidChange(refreshAll);
      watcher.onDidCreate(refreshAll);
      watcher.onDidDelete(refreshAll);
      context.subscriptions.push(watcher);
    }
  }

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("gitwe")) refreshAll();
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const register = (command: string, handler: (...args: any[]) => any): void => {
    context.subscriptions.push(vscode.commands.registerCommand(command, handler));
  };

  register("gitwe.start", () => startBranchCommand(outputChannel, refreshAll));
  register("gitwe.finish", (branch?: string) => finishBranchCommand(outputChannel, refreshAll, branch));
  register("gitwe.status", () => showStatusCommand(outputChannel));
  register("gitwe.graph", () => showGraphCommand(outputChannel));
  register("gitwe.doctor", () => runDoctorCommand(outputChannel));
  register("gitwe.validate", () => validateWorkflowCommand(outputChannel));
  register("gitwe.showTypes", () => showTypesCommand(outputChannel));
  register("gitwe.openConfig", () => openConfigCommand(outputChannel));
  register("gitwe.openDashboard", () => GitwePanel.show(context, outputChannel));
  register("gitwe.refresh", refreshAll);
  register("gitwe.checkoutBranch", (branch?: string) => checkoutBranchCommand(outputChannel, refreshAll, branch));
  register("gitwe.deleteBranch", (branch?: string) => deleteBranchCommand(outputChannel, refreshAll, branch));
  register("gitwe.pull", () => pullCommand(outputChannel, refreshAll));
  register("gitwe.push", () => pushCommand(outputChannel));
  register("gitwe.commitInfo", () => showCommitInfoCommand(outputChannel));
  register("gitwe.currentBranch", () => showCurrentBranchCommand(outputChannel));
}

export function deactivate(): void {
  // Nothing to clean up beyond what's in context.subscriptions.
}
