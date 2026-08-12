import * as vscode from "vscode";
import {
  getEngine,
  getSettings,
  listTopicBranches,
  pickWorkspaceFolder,
} from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";
import { resolveBranchArg } from "../util/treeArgs";
import type { BranchItem } from "../branchesTreeProvider";

interface FinishChoices {
  keep: boolean;
  push: boolean;
  /** When engine supports it; safe no-op if ignored. */
  deleteRemote?: boolean;
}

async function promptFinishOptions(
  branchName: string,
  targets: readonly string[],
  defaults: { deleteAfter: boolean; pushAfter: boolean },
): Promise<FinishChoices | undefined> {
  const targetLabel = targets.length > 0 ? targets.join(", ") : "(none)";

  // Step 1 — confirm + summary
  const summary = await vscode.window.showQuickPick(
    [
      {
        label: "$(check) Finish",
        description: `merge into ${targetLabel}`,
        detail: "Continue to options",
        value: "go" as const,
      },
      {
        label: "$(close) Cancel",
        value: "cancel" as const,
      },
    ],
    {
      title: `Gitwe: Finish ${branchName}`,
      placeHolder: `Targets: ${targetLabel}`,
      ignoreFocusOut: true,
    },
  );
  if (!summary || summary.value === "cancel") return undefined;

  // Step 2 — delete local?
  const deletePick = await vscode.window.showQuickPick(
    [
      {
        label: "Delete local branch after finish",
        description: defaults.deleteAfter ? "(default)" : undefined,
        value: true,
      },
      {
        label: "Keep local branch",
        description: !defaults.deleteAfter ? "(default)" : undefined,
        value: false,
      },
    ],
    {
      title: `Gitwe: Finish ${branchName} — local branch`,
      placeHolder: "What to do with the topic branch after merge?",
      ignoreFocusOut: true,
    },
  );
  if (!deletePick) return undefined;

  // Step 3 — push?
  const pushPick = await vscode.window.showQuickPick(
    [
      {
        label: "Push to remote after finish",
        description: defaults.pushAfter ? "(default)" : undefined,
        value: true,
      },
      {
        label: "Do not push",
        description: !defaults.pushAfter ? "(default)" : undefined,
        value: false,
      },
    ],
    {
      title: `Gitwe: Finish ${branchName} — remote`,
      placeHolder: "Push targets / tags if the workflow creates them?",
      ignoreFocusOut: true,
    },
  );
  if (!pushPick) return undefined;

  // Step 4 — delete remote topic branch? (only if we will delete local and user may have published)
  let deleteRemote = false;
  if (deletePick.value) {
    const remotePick = await vscode.window.showQuickPick(
      [
        {
          label: "Also delete remote topic branch",
          description: "origin/<branch> if it exists",
          value: true,
        },
        {
          label: "Leave remote topic branch",
          description: "(default)",
          value: false,
        },
      ],
      {
        title: `Gitwe: Finish ${branchName} — remote topic branch`,
        placeHolder: "Delete the remote copy of this topic branch?",
        ignoreFocusOut: true,
      },
    );
    if (!remotePick) return undefined;
    deleteRemote = remotePick.value;
  }

  return {
    keep: !deletePick.value,
    push: pushPick.value,
    deleteRemote,
  };
}

export async function finishBranchCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  preselected?: string | BranchItem,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const settings = getSettings();

    let branchName = resolveBranchArg(preselected);
    if (!branchName) {
      const branches = await listTopicBranches(engine);
      const picked = await vscode.window.showQuickPick(
        branches.map((b) => ({
          label: b.name,
          description: b.current ? "current" : b.typeName,
        })),
        { placeHolder: "Branch to finish", title: "Gitwe: Finish Branch" },
      );
      if (!picked) return;
      branchName = picked.label;
    }

    const resolved = engine.workflow.resolveBranch(branchName);
    if (!resolved) {
      void vscode.window.showErrorMessage(
        `Gitwe: "${branchName}" does not match any configured branch type.`,
      );
      return;
    }

    const targets = resolved.type.target;

    let choices: FinishChoices = {
      keep: !settings.deleteAfterFinish,
      push: settings.pushAfterFinish,
      deleteRemote: false,
    };

    if (settings.confirmFinish) {
      const prompted = await promptFinishOptions(branchName, targets, {
        deleteAfter: settings.deleteAfterFinish,
        pushAfter: settings.pushAfterFinish,
      });
      if (!prompted) return;
      choices = prompted;
    }

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Gitwe: finishing ${branchName}…`,
      },
      () =>
        engine.finish(resolved, {
          keep: choices.keep,
          push: choices.push,
          // gitwe-ts may ignore unknown keys; safe to pass when supported
          ...(choices.deleteRemote ? { deleteRemote: true } : {}),
        } as Parameters<typeof engine.finish>[1]),
    );

    const parts: string[] = [
      `merged ${branchName} into ${result.base ?? targets.join(", ")}`,
    ];
    if (result.tag) parts.push(`tagged ${result.tag}`);
    if (result.deletedLocal) parts.push("local branch deleted");

    void vscode.window.showInformationMessage(`Gitwe: ${parts.join(" · ")}.`);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
