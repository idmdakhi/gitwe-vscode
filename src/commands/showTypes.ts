import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function showTypesCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    outputChannel.appendLine(`─── Gitwe branch types (workflow: ${engine.workflow.config.name}) ───`);
    for (const type of engine.workflow.branchTypes) {
      outputChannel.appendLine(
        `${type.name.padEnd(12)} prefix="${type.prefix}"  base="${type.base}"  merges into: ${type.target.join(", ") || "(none)"}`,
      );
    }
    outputChannel.show(true);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
