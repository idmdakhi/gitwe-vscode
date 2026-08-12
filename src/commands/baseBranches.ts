import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function checkoutBaseBranchCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const current = await engine.git.currentBranch();

    const picked = await vscode.window.showQuickPick(
      engine.workflow.baseBranches
        .filter((b) => b.name !== current)
        .map((b) => ({ label: b.name, description: b.base ? `from ${b.base}` : "root" })),
      { placeHolder: "Base branch to checkout", title: "Gitwe: Checkout Base Branch" },
    );
    if (!picked) return;

    await engine.git.checkout(picked.label);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}

/** Fetches the remote and fast-forwards every local base branch (main/develop/…) to match it. */
export async function syncBaseBranchesCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const remote = engine.workflow.remoteName;

    const synced = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Gitwe: syncing base branches…" },
      async () => {
        await engine.git.fetch(remote);
        const current = await engine.git.currentBranch();
        const results: string[] = [];
        for (const base of engine.workflow.baseBranches) {
          if (!(await engine.git.branchExists(base.name))) continue;
          if (!(await engine.git.remoteBranchExists(remote, base.name))) continue;
          try {
            if (base.name === current) {
              await engine.git.raw(["merge", "--ff-only", `${remote}/${base.name}`]);
            } else {
              await engine.git.raw(["fetch", remote, `${base.name}:${base.name}`]);
            }
            results.push(base.name);
          } catch {
            // Not fast-forwardable (local commits ahead/diverged) — leave it for the user to handle manually.
          }
        }
        return results;
      },
    );

    void vscode.window.showInformationMessage(
      synced.length > 0
        ? `Gitwe: synced ${synced.join(", ")}.`
        : "Gitwe: nothing to sync (all base branches already up to date or diverged).",
    );
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
