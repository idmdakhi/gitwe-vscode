import * as vscode from "vscode";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function checkoutBranchCommand(
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
      branches.filter((b) => !b.isCurrent).map((b) => ({ label: b.name })),
      { placeHolder: "Branch to checkout", title: "Gitwe: Checkout Branch" },
    );
    if (!picked) return;
    target = picked.label;
  }

  try {
    await container.git.checkout(target);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
