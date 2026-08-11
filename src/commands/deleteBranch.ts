import * as vscode from "vscode";
import { getEngine, listTopicBranches, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function deleteBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  branchName?: string,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);

    let target = branchName;
    if (!target) {
      const branches = await listTopicBranches(engine);
      const picked = await vscode.window.showQuickPick(
        branches.map((b) => ({ label: b.name, description: b.typeName })),
        { placeHolder: "Branch to delete", title: "Gitwe: Delete Branch" },
      );
      if (!picked) return;
      target = picked.label;
    }

    const resolved = engine.workflow.resolveBranch(target);
    if (!resolved) {
      void vscode.window.showErrorMessage(`Gitwe: "${target}" does not match any configured branch type.`);
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete branch "${target}"? This cannot be undone from here.`,
      { modal: true },
      "Delete",
    );
    if (confirm !== "Delete") return;

    await engine.deleteBranchType(resolved, {});
    void vscode.window.showInformationMessage(`Gitwe: deleted ${target}.`);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
