import * as vscode from "vscode";
import type { BranchTreeNode } from "gitwe";
import { getContainer, getSettings, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

function renderTree(node: BranchTreeNode, prefix = "", isLast = true): string {
  const marker = prefix === "" ? "" : isLast ? "└── " : "├── ";
  const label = node.isCurrent ? `${node.name} (current)` : node.name;
  const lines = [`${prefix}${marker}${label}`];
  const childPrefix = prefix + (prefix === "" ? "" : isLast ? "    " : "│   ");
  node.children.forEach((child, i) => lines.push(renderTree(child, childPrefix, i === node.children.length - 1)));
  return lines.join("\n");
}

export async function showGraphCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const container = getContainer(folder, outputChannel);
  try {
    const report = await container.getStatusHandler.handle({ rootBranch: getSettings().defaultRootBranch });
    outputChannel.appendLine("─── Gitwe branch graph ───");
    outputChannel.appendLine(renderTree(report.tree));
    outputChannel.show(true);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
