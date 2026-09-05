import * as vscode from "vscode";
import * as path from "node:path";
import { GitweRepo } from "./cli";
import { GitweStatusBar } from "./statusBar";
import { GitweBranchesProvider } from "./branchesTreeProvider";
import { GitweDashboardPanel } from "./dashboardPanel";
import { registerCommands } from "./commands";

let repo: GitweRepo | undefined;

function getRepo(): GitweRepo | undefined {
  return repo;
}

async function resolveRepoForWorkspace(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    repo = undefined;
    await vscode.commands.executeCommand("setContext", "gitwe.hasWorkflow", false);
    return;
  }

  // Single-root is the common case; for multi-root, prefer a folder that has
  // .gitwe/gitwe.yaml, falling back to the first folder.
  let chosen = folders[0].uri.fsPath;
  for (const folder of folders) {
    const candidate = vscode.Uri.file(path.join(folder.uri.fsPath, ".gitwe", "gitwe.yaml"));
    try {
      await vscode.workspace.fs.stat(candidate);
      chosen = folder.uri.fsPath;
      break;
    } catch {
      // not this folder
    }
  }

  repo = new GitweRepo(chosen);

  const marker = vscode.Uri.file(path.join(chosen, ".gitwe", "gitwe.yaml"));
  const hasWorkflow = await vscode.workspace.fs.stat(marker).then(
    () => true,
    () => false,
  );
  await vscode.commands.executeCommand("setContext", "gitwe.hasWorkflow", hasWorkflow);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await resolveRepoForWorkspace();

  const branchesProvider = new GitweBranchesProvider(getRepo);
  const treeView = vscode.window.createTreeView("gitwe.branches", {
    treeDataProvider: branchesProvider,
    showCollapseAll: true,
  });

  const statusBar = new GitweStatusBar(getRepo);
  void statusBar.refresh();

  const refreshAll = () => {
    branchesProvider.refresh();
    void statusBar.refresh();
    void GitweDashboardPanel.show; // no-op reference kept for clarity; panel refreshes itself when open
  };

  registerCommands(context, { getRepo, refreshAll });

  context.subscriptions.push(
    treeView,
    statusBar,
    vscode.commands.registerCommand("gitwe.openDashboard", () => {
      GitweDashboardPanel.show(context, getRepo);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await resolveRepoForWorkspace();
      refreshAll();
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.endsWith(path.join(".gitwe", "gitwe.yaml"))) refreshAll();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("gitwe")) refreshAll();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => void statusBar.refresh()),
  );

  // Watch for git ref changes (branch switches, commits) to keep the view fresh
  // without polling: `.git/HEAD` changes on every checkout/commit.
  const gitHeadWatcher = vscode.workspace.createFileSystemWatcher("**/.git/{HEAD,refs/heads/**}");
  gitHeadWatcher.onDidChange(refreshAll);
  gitHeadWatcher.onDidCreate(refreshAll);
  gitHeadWatcher.onDidDelete(refreshAll);
  context.subscriptions.push(gitHeadWatcher);
}

export function deactivate(): void {
  // Nothing to clean up beyond what's registered in context.subscriptions.
}
