import * as vscode from "vscode";
import { getContainer, getSettings, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function finishBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  preselected?: string,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const container = getContainer(folder, outputChannel);
  const settings = getSettings();

  let branchName = preselected;
  if (!branchName) {
    const branches = await container.listBranchesHandler.handle();
    const picked = await vscode.window.showQuickPick(
      branches.map((b) => ({ label: b.name, description: b.isCurrent ? "current" : undefined })),
      { placeHolder: "Branch to finish", title: "Gitwe: Finish Branch" },
    );
    if (!picked) return;
    branchName = picked.label;
  }

  if (settings.confirmFinish) {
    const confirm = await vscode.window.showWarningMessage(
      `Finish "${branchName}"? This merges it into its configured target(s)` +
        `${settings.deleteAfterFinish ? " and deletes it afterwards" : ""}.`,
      { modal: true },
      "Finish",
    );
    if (confirm !== "Finish") return;
  }

  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Gitwe: finishing ${branchName}…` },
      () =>
        container.finishBranchHandler.handle({
          branchName: branchName!,
          deleteAfterMerge: settings.deleteAfterFinish,
          pushAfterFinish: settings.pushAfterFinish,
        }),
    );
    const tagMessage = result.tags.length > 0 ? ` Tagged: ${result.tags.join(", ")}.` : "";
    const deleteMessage = result.deleted ? " Branch deleted." : "";
    void vscode.window.showInformationMessage(
      `Gitwe: merged ${branchName} into ${result.merges.map((m) => m.target).join(", ")}.${tagMessage}${deleteMessage}`,
    );
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
