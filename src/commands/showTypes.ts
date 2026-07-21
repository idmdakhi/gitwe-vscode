import * as vscode from "vscode";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder } from "../util/errors";

export function showTypesCommand(outputChannel: vscode.OutputChannel): void {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;
  const container = getContainer(folder, outputChannel);

  outputChannel.appendLine(`─── Gitwe branch types (workflow: ${container.workflow.name}) ───`);
  for (const rule of container.workflow.branchTypes) {
    const tag = rule.autoTag ? " (auto-tags)" : "";
    outputChannel.appendLine(
      `${rule.name.padEnd(12)} prefix="${rule.prefix}"  base="${rule.baseBranch}"  merges into: ${rule.mergeTargets.join(", ")}${tag}`,
    );
  }
  outputChannel.show(true);
}
