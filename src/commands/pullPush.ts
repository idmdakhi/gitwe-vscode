import * as vscode from "vscode";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function pullCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;
  const container = getContainer(folder, outputChannel);
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Gitwe: pulling…" },
      () => container.git.pull(container.workflow.remote.remote),
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
  const container = getContainer(folder, outputChannel);
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Gitwe: pushing…" },
      () => container.git.push(container.workflow.remote.remote),
    );
    void vscode.window.showInformationMessage(`Gitwe: pushed to ${container.workflow.remote.remote}.`);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
