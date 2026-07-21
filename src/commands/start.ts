import * as vscode from "vscode";
import { UnknownBranchTypeError, InvalidBranchNameError, BranchAlreadyExistsError } from "gitwe";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function startBranchCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const container = getContainer(folder, outputChannel);

  const typePick = await vscode.window.showQuickPick(
    container.workflow.branchTypes.map((rule) => ({
      label: rule.name,
      description: `"${rule.prefix}*" from "${rule.baseBranch}"`,
    })),
    { placeHolder: "Branch type", title: "Gitwe: Start Branch" },
  );
  if (!typePick) return;

  const shortName = await vscode.window.showInputBox({
    title: `Gitwe: Start ${typePick.label} branch`,
    prompt: "Short branch name",
    placeHolder: "login",
    validateInput: (value) => (value.trim() ? undefined : "Required"),
  });
  if (!shortName) return;

  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Gitwe: starting ${typePick.label}/${shortName}…` },
      () => container.startBranchHandler.handle({ branchType: typePick.label, shortName }),
    );
    void vscode.window.showInformationMessage(`Gitwe: started ${result.branchName} from ${result.baseBranch}.`);
    onDone();
  } catch (error) {
    if (
      error instanceof UnknownBranchTypeError ||
      error instanceof InvalidBranchNameError ||
      error instanceof BranchAlreadyExistsError
    ) {
      void vscode.window.showErrorMessage(`Gitwe: ${error.message}`);
      return;
    }
    await showGitweError(error, outputChannel);
  }
}
