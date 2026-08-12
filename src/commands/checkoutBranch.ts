import * as vscode from "vscode";
import {
  getEngine,
  listTopicBranches,
  pickWorkspaceFolder,
} from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";
import { resolveBranchArg } from "../util/treeArgs";
import type { BranchItem } from "../branchesTreeProvider";

export async function checkoutBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
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
        branches
          .filter((b) => !b.current)
          .map((b) => ({ label: b.name, description: b.typeName })),
        { placeHolder: "Branch to checkout", title: "Gitwe: Checkout Branch" },
      );
      if (!picked) return;
      target = picked.label;
    }

    await engine.git.checkout(target);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
