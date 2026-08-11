import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function pullCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;
  try {
    const engine = await getEngine(folder, outputChannel);
    const remote = engine.workflow.remoteName;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Gitwe: pulling…" },
      () => engine.git.raw(["pull", remote]),
    );
    void vscode.window.showInformationMessage("Gitwe: pull complete.");
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}

export async function pushCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;
  try {
    const engine = await getEngine(folder, outputChannel);
    const remote = engine.workflow.remoteName;
    const branch = await engine.git.currentBranch();
    if (!branch) {
      void vscode.window.showWarningMessage("Gitwe: HEAD is detached; check out a branch first.");
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Gitwe: pushing…" },
      () => engine.git.push(remote, branch, { setUpstream: true }),
    );
    void vscode.window.showInformationMessage(`Gitwe: pushed ${branch} to ${remote}.`);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
