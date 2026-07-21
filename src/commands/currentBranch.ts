import * as vscode from "vscode";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function showCurrentBranchCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;
  const container = getContainer(folder, outputChannel);
  try {
    const branch = await container.git.getCurrentBranch();
    void vscode.window.showInformationMessage(`Gitwe: current branch is ${branch}.`);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
