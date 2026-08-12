import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";
import { resolveTypeArg } from "../util/treeArgs";
import type { BranchTypeItem } from "../branchesTreeProvider";

export async function startBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  typeArg?: string | BranchTypeItem,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);

    let typeName = resolveTypeArg(typeArg);
    if (!typeName) {
      const typePick = await vscode.window.showQuickPick(
        engine.workflow.branchTypes.map((type) => ({
          label: type.name,
          description: `"${type.prefix}*" from "${type.base}"`,
        })),
        { placeHolder: "Branch type", title: "Gitwe: Start Branch" },
      );
      if (!typePick) return;
      typeName = typePick.label;
    }

    const shortName = await vscode.window.showInputBox({
      title: `Gitwe: Start ${typeName} branch`,
      prompt: "Short branch name",
      placeHolder: "login",
      validateInput: (value) => (value.trim() ? undefined : "Required"),
    });
    if (!shortName) return;

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Gitwe: starting ${typeName}/${shortName}…`,
      },
      () => engine.start(typeName!, shortName, { fetch: true }),
    );
    void vscode.window.showInformationMessage(
      `Gitwe: started ${result.branch} from ${result.startPoint}.`,
    );
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
