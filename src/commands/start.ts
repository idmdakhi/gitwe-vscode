import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function startBranchCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);

    const typePick = await vscode.window.showQuickPick(
      engine.workflow.branchTypes.map((type) => ({
        label: type.name,
        description: `"${type.prefix}*" from "${type.base}"`,
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

    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Gitwe: starting ${typePick.label}/${shortName}…` },
      () => engine.start(typePick.label, shortName, { fetch: true }),
    );
    void vscode.window.showInformationMessage(`Gitwe: started ${result.branch} from ${result.startPoint}.`);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
