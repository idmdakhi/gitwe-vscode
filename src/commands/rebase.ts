import * as vscode from "vscode";
import {
  getEngine,
  listTopicBranches,
  pickWorkspaceFolder,
} from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";
import { resolveBranchArg } from "../util/treeArgs";
import type { BranchItem } from "../branchesTreeProvider";

/**
 * Rebase a topic branch onto its configured base.
 * Prefer engine.update with strategy when available; fall back to git rebase.
 */
export async function rebaseOntoBaseCommand(
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
        branches.map((b) => ({
          label: b.name,
          description: b.current ? "current" : b.typeName,
        })),
        { placeHolder: "Branch to rebase", title: "Gitwe: Rebase onto Base" },
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

    const base = resolved.type.base;
    const confirm = await vscode.window.showWarningMessage(
      `Rebase "${target}" onto "${base}"?`,
      { modal: true },
      "Rebase",
    );
    if (confirm !== "Rebase") return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Gitwe: rebasing ${target} onto ${base}…`,
      },
      async () => {
        // Prefer domain update API if it accepts strategy
        try {
          const result = await engine.update(resolved, {
            fetch: true,
            strategy: "rebase",
          } as Parameters<typeof engine.update>[1]);
          if (result.alreadyUpToDate) {
            void vscode.window.showInformationMessage(
              `Gitwe: ${target} is already up to date with ${base}.`,
            );
          } else {
            void vscode.window.showInformationMessage(
              `Gitwe: rebased ${target} onto ${base}.`,
            );
          }
          return;
        } catch {
          // Fallback: raw git
        }

        const current = await engine.git.currentBranch();
        if (current !== target) {
          await engine.git.checkout(target);
        }
        await engine.git.fetch(engine.workflow.remoteName);
        await engine.git.raw(["rebase", base]);
        void vscode.window.showInformationMessage(
          `Gitwe: rebased ${target} onto ${base}.`,
        );
      },
    );

    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
