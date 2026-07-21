import * as vscode from "vscode";
import { WorkflowConfigLoader } from "gitwe";
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
    const workflow = new WorkflowConfigLoader().load(files[0].fsPath);
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
