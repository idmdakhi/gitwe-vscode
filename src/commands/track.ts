import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";
import type { BranchItem } from "../branchesTreeProvider";

/** Checks out (creating a local tracking branch if needed) a topic branch that exists on the remote. */
export async function trackBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  branchArg?: string | BranchItem,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const remote = engine.workflow.remoteName;

    // If invoked from a remote TreeItem, branch name is already known
    let remoteBranchName: string | undefined;
    if (branchArg) {
      remoteBranchName =
        typeof branchArg === "string" ? branchArg : branchArg.branchName;
    }

    let typeName: string | undefined;
    let shortName: string | undefined;

    if (remoteBranchName) {
      const resolved = engine.workflow.resolveBranch(remoteBranchName);
      if (resolved) {
        typeName = resolved.type.name;
        shortName = remoteBranchName.slice(resolved.type.prefix.length);
      } else {
        // Fallback: match by prefix
        for (const type of engine.workflow.branchTypes) {
          if (remoteBranchName.startsWith(type.prefix)) {
            typeName = type.name;
            shortName = remoteBranchName.slice(type.prefix.length);
            break;
          }
        }
      }
      if (!typeName || shortName === undefined) {
        void vscode.window.showErrorMessage(
          `Gitwe: "${remoteBranchName}" does not match any configured branch type prefix.`,
        );
        return;
      }
    } else {
      const typePick = await vscode.window.showQuickPick(
        engine.workflow.branchTypes.map((type) => ({
          label: type.name,
          description: `"${type.prefix}*"`,
        })),
        { placeHolder: "Branch type", title: "Gitwe: Track Remote Branch" },
      );
      if (!typePick) return;
      typeName = typePick.label;

      const remoteBranches = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Gitwe: fetching ${remote}…`,
        },
        async () => {
          await engine.git.fetch(remote);
          const type = engine.workflow.requireBranchType(typeName!);
          return (await engine.git.listRemoteBranches(remote)).filter((b) =>
            b.startsWith(type.prefix),
          );
        },
      );
      if (remoteBranches.length === 0) {
        void vscode.window.showInformationMessage(
          `Gitwe: no ${typeName} branches found on ${remote}.`,
        );
        return;
      }

      const branchPick = await vscode.window.showQuickPick(remoteBranches, {
        placeHolder: `${remote} branch to track`,
        title: "Gitwe: Track Remote Branch",
      });
      if (!branchPick) return;

      const type = engine.workflow.requireBranchType(typeName);
      shortName = branchPick.slice(type.prefix.length);
    }

    const branch = await engine.track(typeName, shortName);
    void vscode.window.showInformationMessage(
      `Gitwe: tracking ${branch} from ${remote}.`,
    );
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
