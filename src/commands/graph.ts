import * as vscode from "vscode";
import type { OverviewReport } from "gitwe-ts";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

function renderGraph(
  report: OverviewReport,
  outputChannel: vscode.OutputChannel,
): void {
  outputChannel.appendLine("Base branches:");
  for (const base of report.baseBranches) {
    const marks: string[] = [];
    if (!base.exists) marks.push("missing");
    if (base.current) marks.push("current");
    if (base.ahead > 0) marks.push(`↑${base.ahead}`);
    if (base.behind > 0) marks.push(`↓${base.behind}`);
    const indent = base.base ? "  " : "";
    outputChannel.appendLine(
      `${indent}${base.name}${marks.length ? ` (${marks.join(", ")})` : ""}`,
    );
  }

  outputChannel.appendLine("");
  outputChannel.appendLine("Topic branches:");
  for (const type of report.branchTypes) {
    if (type.branches.length === 0) continue;
    outputChannel.appendLine(`  ${type.name} (${type.prefix} → ${type.base})`);
    for (const branch of type.branches) {
      outputChannel.appendLine(`    ${branch}`);
    }
  }
}

export async function showGraphCommand(
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const report = await engine.overview();
    outputChannel.appendLine("─── Gitwe branch graph ───");
    renderGraph(report, outputChannel);
    outputChannel.show(true);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
