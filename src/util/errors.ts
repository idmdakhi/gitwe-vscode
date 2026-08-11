import * as vscode from "vscode";
import { loadGitwe } from "../gitweModule";

/** Formats any error thrown by gitwe for display, and offers to reveal the output channel. */
export async function showGitweError(error: unknown, outputChannel: vscode.OutputChannel): Promise<void> {
  const { GitweError } = await loadGitwe();
  const message =
    error instanceof GitweError
      ? `[${error.code}] ${error.message}${error.hint ? ` — ${error.hint}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  outputChannel.appendLine(`[ERROR] ${message}`);

  const choice = await vscode.window.showErrorMessage(`Gitwe: ${message}`, "Show Output");
  if (choice === "Show Output") outputChannel.show(true);
}

/** Requires an open workspace folder, warning the user if there isn't one. */
export function requireWorkspaceFolder(
  folder: vscode.WorkspaceFolder | undefined,
): folder is vscode.WorkspaceFolder {
  if (!folder) {
    void vscode.window.showWarningMessage("Gitwe: open a folder with a git repository first.");
    return false;
  }
  return true;
}
