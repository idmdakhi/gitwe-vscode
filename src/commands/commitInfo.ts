import * as vscode from "vscode";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function showCommitInfoCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;
  const container = getContainer(folder, outputChannel);

  const ref = await vscode.window.showInputBox({
    title: "Gitwe: Show Commit Info",
    prompt: "Branch, tag, or commit ref",
    value: "HEAD",
  });
  if (!ref) return;

  try {
    const info = await container.git.getCommitInfo(ref);
    outputChannel.appendLine(`─── Gitwe commit info: ${ref} ───`);
    outputChannel.appendLine(`hash:    ${info.hash}`);
    outputChannel.appendLine(`author:  ${info.author}`);
    outputChannel.appendLine(`date:    ${info.date.toISOString()}`);
    outputChannel.appendLine(`message: ${info.message}`);
    outputChannel.show(true);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
