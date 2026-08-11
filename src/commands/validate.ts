import * as vscode from "vscode";
import { loadGitwe } from "../gitweModule";
import { pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder } from "../util/errors";

export async function validateWorkflowCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const files = await vscode.window.showOpenDialog({
    defaultUri: folder.uri,
    canSelectMany: false,
    filters: { "Workflow config": ["json", "yaml", "yml"] },
    title: "Gitwe: select a workflow config file to validate",
  });
  if (!files || files.length === 0) return;

  try {
    const gitwe = await loadGitwe();
    const config = gitwe.readConfigFile(files[0].fsPath);
    const workflow = gitwe.parseWorkflowConfig(config);
    outputChannel.appendLine(`─── Gitwe validate: ${files[0].fsPath} ───`);
    outputChannel.appendLine(`✅ Valid — "${workflow.name}" (${workflow.branchTypes.length} branch type(s))`);
    outputChannel.show(true);
    void vscode.window.showInformationMessage(
      `Gitwe: "${workflow.name}" is valid (${workflow.branchTypes.length} branch type(s)).`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`❌ Invalid: ${message}`);
    outputChannel.show(true);
    void vscode.window.showErrorMessage(`Gitwe: invalid workflow config — ${message}`);
  }
}
