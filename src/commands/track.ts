import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

/** Checks out (creating a local tracking branch if needed) a topic branch that exists on the remote. */
export async function trackBranchCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const remote = engine.workflow.remoteName;

    const typePick = await vscode.window.showQuickPick(
      engine.workflow.branchTypes.map((type) => ({ label: type.name, description: `"${type.prefix}*"` })),
      { placeHolder: "Branch type", title: "Gitwe: Track Remote Branch" },
    );
    if (!typePick) return;

    const remoteBranches = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Gitwe: fetching ${remote}…` },
      async () => {
        await engine.git.fetch(remote);
        const type = engine.workflow.requireBranchType(typePick.label);
        return (await engine.git.listRemoteBranches(remote)).filter((b) => b.startsWith(type.prefix));
      },
    );
    if (remoteBranches.length === 0) {
      void vscode.window.showInformationMessage(`Gitwe: no ${typePick.label} branches found on ${remote}.`);
      return;
    }

    const branchPick = await vscode.window.showQuickPick(remoteBranches, {
      placeHolder: `${remote} branch to track`,
      title: "Gitwe: Track Remote Branch",
    });
    if (!branchPick) return;

    const shortName = branchPick.slice(engine.workflow.requireBranchType(typePick.label).prefix.length);
    const branch = await engine.track(typePick.label, shortName);
    void vscode.window.showInformationMessage(`Gitwe: tracking ${branch} from ${remote}.`);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
