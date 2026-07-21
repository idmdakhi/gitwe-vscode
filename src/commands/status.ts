import * as vscode from "vscode";
import { getContainer, getSettings, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function showStatusCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const container = getContainer(folder, outputChannel);
  try {
    const report = await container.getStatusHandler.handle({ rootBranch: getSettings().defaultRootBranch });
    outputChannel.appendLine("─── Gitwe status ───");
    outputChannel.appendLine(`On branch:      ${report.currentBranch}`);
    outputChannel.appendLine(`Total branches: ${report.totalBranches}`);
    outputChannel.appendLine(`Branch types:   ${report.branchTypes.join(", ")}`);
    outputChannel.show(true);
    void vscode.window.showInformationMessage(
      `Gitwe: on ${report.currentBranch} — ${report.totalBranches} branch(es). See output for details.`,
    );
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
