import * as vscode from "vscode";
import { getEngine, getSettings, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function openConfigCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    if (!engine.configPath) {
      void vscode.window.showInformationMessage(
        `Gitwe: no workflow file found — using the built-in "${getSettings().workflow}" preset in memory. ` +
          `Run "gitwe init" to write one, or set "gitwe.configPath" to point at a custom file.`,
      );
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(engine.configPath));
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
