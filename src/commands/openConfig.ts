import * as vscode from "vscode";
import * as path from "node:path";
import { getSettings, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder } from "../util/errors";

export async function openConfigCommand(): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const settings = getSettings();
  if (!settings.configPath) {
    void vscode.window.showInformationMessage(
      `Gitwe: no custom config set — using the built-in "${settings.workflow}" workflow. ` +
        `Set "gitwe.configPath" in settings to open a custom one.`,
    );
    return;
  }

  const fullPath = path.resolve(folder.uri.fsPath, settings.configPath);
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
  await vscode.window.showTextDocument(doc);
}
