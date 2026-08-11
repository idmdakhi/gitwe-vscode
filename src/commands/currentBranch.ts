import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function showCurrentBranchCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;
  try {
    const engine = await getEngine(folder, outputChannel);
    const branch = await engine.git.currentBranch();
    void vscode.window.showInformationMessage(
      branch ? `Gitwe: current branch is ${branch}.` : "Gitwe: HEAD is detached.",
    );
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
