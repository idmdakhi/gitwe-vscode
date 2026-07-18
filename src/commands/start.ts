// vscode-extension/src/commands/start.ts
import * as vscode from "vscode";
import { getGitRoot, createEngine, showError } from "../utils";

export async function startBranch() {
  const root = getGitRoot();
  if (!root) return;

  const type = await vscode.window.showInputBox({
    prompt: "Enter branch type (e.g., feature, release, hotfix)",
    placeHolder: "feature",
  });
  if (!type) return;

  const name = await vscode.window.showInputBox({
    prompt: "Enter short name for the branch",
    placeHolder: "my-feature",
  });
  if (!name) return;

  const engine = createEngine(root);
  try {
    const fullName = await engine.start(type, name);
    vscode.window.showInformationMessage(
      `✅ Branch "${fullName}" created and checked out.`,
    );
  } catch (err) {
    showError(err);
  }
}
