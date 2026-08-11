import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function showStatusCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const report = await engine.overview();

    outputChannel.appendLine("─── Gitwe status ───");
    outputChannel.appendLine(`Workflow:       ${report.workflow}`);
    outputChannel.appendLine(`On branch:      ${report.currentBranch ?? "(detached)"}`);
    for (const base of report.baseBranches) {
      const marks: string[] = [];
      if (!base.exists) marks.push("missing");
      if (base.ahead > 0) marks.push(`↑${base.ahead}`);
      if (base.behind > 0) marks.push(`↓${base.behind}`);
      outputChannel.appendLine(`  ${base.name}${marks.length ? ` (${marks.join(", ")})` : ""}`);
    }
    outputChannel.appendLine("Branch types:");
    for (const type of report.branchTypes) {
      outputChannel.appendLine(`  ${type.name.padEnd(12)} ${type.branches.length} branch(es)`);
    }
    outputChannel.appendLine("Health:");
    for (const check of report.health) {
      const icon = check.level === "ok" ? "✅" : check.level === "warning" ? "⚠️" : "❌";
      outputChannel.appendLine(`  ${icon} ${check.message}`);
    }
    outputChannel.show(true);

    const totalBranches = report.branchTypes.reduce((sum, t) => sum + t.branches.length, 0);
    void vscode.window.showInformationMessage(
      `Gitwe: on ${report.currentBranch ?? "(detached)"} — ${totalBranches} topic branch(es). See output for details.`,
    );
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
