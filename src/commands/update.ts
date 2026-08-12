import * as vscode from "vscode";
import { getEngine, listTopicBranches, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

/** Merges (or rebases) the branch type's base into a topic branch — git-flow's "Pull"/update. */
export async function updateBranchCommand(
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
        branches.map((b) => ({ label: b.name, description: b.current ? "current" : b.typeName })),
        { placeHolder: "Branch to update", title: "Gitwe: Update Branch from Base" },
      );
      if (!picked) return;
      target = picked.label;
    }

    const resolved = engine.workflow.resolveBranch(target);
    if (!resolved) {
      void vscode.window.showErrorMessage(`Gitwe: "${target}" does not match any configured branch type.`);
      return;
    }

    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Gitwe: updating ${target}…` },
      () => engine.update(resolved, { fetch: true }),
    );
    void vscode.window.showInformationMessage(
      result.alreadyUpToDate
        ? `Gitwe: ${target} is already up to date with ${result.base}.`
        : `Gitwe: ${result.strategy === "rebase" ? "rebased" : "merged"} ${result.base} into ${target}.`,
    );
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
