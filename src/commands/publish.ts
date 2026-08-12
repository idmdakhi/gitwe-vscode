import * as vscode from "vscode";
import {
  getEngine,
  listTopicBranches,
  pickWorkspaceFolder,
} from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";
import { resolveBranchArg } from "../util/treeArgs";
import type { BranchItem } from "../branchesTreeProvider";

/** Pushes a topic branch to the remote with `-u` (git-flow's "Publish"). */
export async function publishBranchCommand(
  outputChannel: vscode.OutputChannel,
  branchArg?: string | BranchItem,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);

    let target = resolveBranchArg(branchArg);
    if (!target) {
      const branches = await listTopicBranches(engine);
      const picked = await vscode.window.showQuickPick(
        branches.map((b) => ({
          label: b.name,
          description: b.current ? "current" : b.typeName,
        })),
        { placeHolder: "Branch to publish", title: "Gitwe: Publish Branch" },
      );
      if (!picked) return;
      target = picked.label;
    }

    const resolved = engine.workflow.resolveBranch(target);
    if (!resolved) {
      void vscode.window.showErrorMessage(
        `Gitwe: "${target}" does not match any configured branch type.`,
      );
      return;
    }

    const remoteRef = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Gitwe: publishing ${target}…`,
      },
      () => engine.publish(resolved),
    );
    void vscode.window.showInformationMessage(
      `Gitwe: published ${target} to ${remoteRef}.`,
    );
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
