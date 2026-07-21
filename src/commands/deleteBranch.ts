import * as vscode from "vscode";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function deleteBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  branchName?: string,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const container = getContainer(folder, outputChannel);

  let target = branchName;
  if (!target) {
    const branches = await container.listBranchesHandler.handle();
    const picked = await vscode.window.showQuickPick(
      branches.map((b) => ({ label: b.name })),
      { placeHolder: "Branch to delete", title: "Gitwe: Delete Branch" },
    );
    if (!picked) return;
    target = picked.label;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Delete branch "${target}"? This cannot be undone from here.`,
    { modal: true },
    "Delete",
  );
  if (confirm !== "Delete") return;

  try {
    await container.git.deleteBranch(target);
    void vscode.window.showInformationMessage(`Gitwe: deleted ${target}.`);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
