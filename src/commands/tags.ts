import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function listTagsCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const tags = await engine.git.tags();
    outputChannel.appendLine("─── Gitwe tags ───");
    if (tags.length === 0) {
      outputChannel.appendLine("(no tags)");
    } else {
      for (const tag of tags) outputChannel.appendLine(tag);
    }
    outputChannel.show(true);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}

export async function pushTagCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const tags = await engine.git.tags();
    if (tags.length === 0) {
      void vscode.window.showInformationMessage("Gitwe: no tags to push.");
      return;
    }
    const tag = await vscode.window.showQuickPick(tags, { placeHolder: "Tag to push", title: "Gitwe: Push Tag" });
    if (!tag) return;

    const remote = engine.workflow.remoteName;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Gitwe: pushing tag ${tag}…` },
      () => engine.git.push(remote, tag),
    );
    void vscode.window.showInformationMessage(`Gitwe: pushed tag ${tag} to ${remote}.`);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}

export async function deleteTagCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const tags = await engine.git.tags();
    if (tags.length === 0) {
      void vscode.window.showInformationMessage("Gitwe: no tags to delete.");
      return;
    }
    const tag = await vscode.window.showQuickPick(tags, { placeHolder: "Tag to delete", title: "Gitwe: Delete Tag" });
    if (!tag) return;

    const scope = await vscode.window.showQuickPick(
      [
        { label: "Local only", value: "local" as const },
        { label: "Local and remote", value: "both" as const },
      ],
      { placeHolder: `Delete ${tag} where?`, title: "Gitwe: Delete Tag" },
    );
    if (!scope) return;

    const confirm = await vscode.window.showWarningMessage(`Delete tag "${tag}"? This cannot be undone.`, { modal: true }, "Delete");
    if (confirm !== "Delete") return;

    await engine.git.deleteTag(tag);
    if (scope.value === "both") {
      const remote = engine.workflow.remoteName;
      await engine.git.push(remote, tag, { delete: true });
    }
    void vscode.window.showInformationMessage(`Gitwe: deleted tag ${tag}${scope.value === "both" ? " (local + remote)" : ""}.`);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
