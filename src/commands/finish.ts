import * as vscode from "vscode";
import { getEngine, getSettings, listTopicBranches, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function finishBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  preselected?: string,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const settings = getSettings();

    let branchName = preselected;
    if (!branchName) {
      const branches = await listTopicBranches(engine);
      const picked = await vscode.window.showQuickPick(
        branches.map((b) => ({ label: b.name, description: b.current ? "current" : b.typeName })),
        { placeHolder: "Branch to finish", title: "Gitwe: Finish Branch" },
      );
      if (!picked) return;
      branchName = picked.label;
    }

    const resolved = engine.workflow.resolveBranch(branchName);
    if (!resolved) {
      void vscode.window.showErrorMessage(`Gitwe: "${branchName}" does not match any configured branch type.`);
      return;
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

    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Gitwe: finishing ${branchName}…` },
      () =>
        engine.finish(resolved, {
          keep: !settings.deleteAfterFinish,
          push: settings.pushAfterFinish,
        }),
    );
    const tagMessage = result.tag ? ` Tagged: ${result.tag}.` : "";
    const deleteMessage = result.deletedLocal ? " Branch deleted." : "";
    void vscode.window.showInformationMessage(
      `Gitwe: merged ${branchName} into ${result.base}.${tagMessage}${deleteMessage}`,
    );
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
