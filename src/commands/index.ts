import * as vscode from "vscode";
import { GitweClient } from "../gitwe/client";
import { BranchesTreeProvider } from "../providers/branchesTree";
import { StatusBarProvider } from "../providers/statusBar";
import { GraphWebView } from "../providers/graphWebView";
import { getConfig } from "../config/settings";

// ===== START =====
export async function startHandler(
  client: GitweClient,
  treeProvider: BranchesTreeProvider,
  statusBar: StatusBarProvider,
) {
  const types = client.workflow.branchTypes.map((t) => t.name);
  const type = await vscode.window.showQuickPick(types, {
    placeHolder: "Select branch type",
  });
  if (!type) return;

  const shortName = await vscode.window.showInputBox({
    prompt: "Enter short name (e.g., login)",
    validateInput: (value) => {
      if (!value.trim()) return "Name cannot be empty";
      if (/\s/.test(value)) return "No spaces allowed";
      return null;
    },
  });
  if (!shortName) return;

  try {
    const result = await client.startBranch(type, shortName);
    vscode.window.showInformationMessage(`✅ Started ${result.branchName}`);
    treeProvider.refresh();
    statusBar.update();
  } catch (error) {
    vscode.window.showErrorMessage(`❌ Start failed: ${error.message}`);
  }
}

// ===== FINISH =====
export async function finishHandler(
  client: GitweClient,
  treeProvider: BranchesTreeProvider,
  statusBar: StatusBarProvider,
  branchName?: string,
) {
  if (!branchName) {
    branchName = await vscode.window.showInputBox({
      prompt: "Branch name to finish",
      value: await client.getCurrentBranch(),
    });
  }
  if (!branchName) return;

  const config = getConfig();
  const deleteOption = await vscode.window.showQuickPick(
    ["Yes (default)", "No"],
    { placeHolder: "Delete branch after finish?" },
  );
  const deleteAfter = deleteOption !== "No";
  const pushOption = await vscode.window.showQuickPick(
    ["No (default)", "Yes"],
    { placeHolder: "Push to remote?" },
  );
  const push = pushOption === "Yes";

  try {
    const result = await client.finishBranch(branchName, deleteAfter, push);
    const msg = `✅ Finished ${branchName} → ${result.merges.map((m) => m.target).join(", ")}`;
    vscode.window.showInformationMessage(msg);
    treeProvider.refresh();
    statusBar.update();
  } catch (error) {
    vscode.window.showErrorMessage(`❌ Finish failed: ${error.message}`);
  }
}

// ===== STATUS =====
export async function statusHandler(client: GitweClient) {
  try {
    const report = await client.getStatus("main");
    const items = [
      `Current: ${report.currentBranch}`,
      `Total: ${report.totalBranches}`,
      `Types: ${report.branchTypes.join(", ")}`,
    ];
    vscode.window.showInformationMessage(items.join(" | "));
  } catch (error) {
    vscode.window.showErrorMessage(`Status failed: ${error.message}`);
  }
}

// ===== GRAPH =====
export function graphHandler(
  client: GitweClient,
  treeProvider: BranchesTreeProvider,
  statusBar: StatusBarProvider,
) {
  const context =
    vscode.extensions.getExtension("gitwe.vscode-gitwe")!.extensionContext;
  GraphWebView.createOrShow(context, client);
}

// ===== CURRENT =====
export async function currentHandler(client: GitweClient) {
  try {
    const branch = await client.getCurrentBranch();
    vscode.window.showInformationMessage(`Current branch: ${branch}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed: ${error.message}`);
  }
}

// ===== LIST =====
export async function listHandler(client: GitweClient) {
  try {
    const branches = await client.listBranches();
    const items = branches.map((b) => `${b.isCurrent ? "✓ " : "  "} ${b.name}`);
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: `Local branches (${branches.length})`,
    });
    if (picked) {
      const branchName = picked.replace(/^[✓ ]\s*/, "");
      await client.checkout(branchName);
      vscode.window.showInformationMessage(`Switched to ${branchName}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed: ${error.message}`);
  }
}

// ===== TYPES =====
export function typesHandler(client: GitweClient) {
  const rules = client.workflow.branchTypes.map((rule) => ({
    name: rule.name,
    prefix: rule.prefix,
    base: rule.baseBranch,
    targets: rule.mergeTargets.join(", "),
    autoTag: rule.autoTag ? "✓" : "✗",
  }));
  const items = rules.map(
    (r) =>
      `${r.name.padEnd(12)} prefix: ${r.prefix.padEnd(12)} base: ${r.base.padEnd(10)} → ${r.targets}  tag: ${r.autoTag}`,
  );
  vscode.window.showQuickPick(items, { placeHolder: "Branch types" });
}

// ===== VALIDATE =====
export async function validateHandler(client: GitweClient) {
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    filters: { Config: ["json", "yaml", "yml"] },
  });
  if (!uris || uris.length === 0) return;

  const path = uris[0].fsPath;
  try {
    const result = client.validateConfig(path);
    if (result.valid) {
      vscode.window.showInformationMessage(
        `✅ "${result.workflowName}" is valid (${result.branchTypeCount} types)`,
      );
    } else {
      vscode.window.showErrorMessage(`❌ Invalid: ${result.error}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`❌ Validation failed: ${error.message}`);
  }
}

// ===== DOCTOR =====
export async function doctorHandler(client: GitweClient) {
  try {
    const report = await client.doctor();
    const status = report.healthy ? "✅ All checks passed" : "⚠️ Issues found";
    const checks = report.checks.map(
      (c) =>
        `${c.passed ? "✅" : "❌"} ${c.name}${c.detail ? `: ${c.detail}` : ""}`,
    );
    const output = client.getOutputChannel();
    output.clear();
    output.appendLine("=== Gitwe Doctor ===");
    output.appendLine(status);
    output.appendLine("");
    output.appendLine(checks.join("\n"));
    output.show();
    if (!report.healthy) {
      vscode.window.showWarningMessage("⚠️ Doctor found issues");
    } else {
      vscode.window.showInformationMessage("✅ Doctor: All good");
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Doctor failed: ${error.message}`);
  }
}

// ===== CONFIG =====
export function configHandler(client: GitweClient) {
  const config = client.getWorkflowConfig();
  const output = client.getOutputChannel();
  output.clear();
  output.appendLine("=== Gitwe Active Configuration ===");
  output.appendLine(JSON.stringify(config, null, 2));
  output.show();
}

// ===== CHECKOUT =====
export async function checkoutHandler(
  client: GitweClient,
  treeProvider: BranchesTreeProvider,
  statusBar: StatusBarProvider,
  branchName?: string,
) {
  if (!branchName) {
    const branches = await client.listBranches();
    const items = branches.map((b) => b.name);
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: "Select branch to checkout",
    });
    if (!picked) return;
    branchName = picked;
  }

  try {
    await client.checkout(branchName);
    vscode.window.showInformationMessage(`Switched to ${branchName}`);
    treeProvider.refresh();
    statusBar.update();
  } catch (error) {
    vscode.window.showErrorMessage(`Checkout failed: ${error.message}`);
  }
}

// ===== REFRESH =====
export function refreshHandler(
  client: GitweClient,
  treeProvider: BranchesTreeProvider,
  statusBar: StatusBarProvider,
) {
  treeProvider.refresh();
  statusBar.update();
  vscode.window.showInformationMessage("✅ Gitwe views refreshed");
}

export async function rebaseHandler(client: GitweClient) {
  const branch = await vscode.window.showInputBox({
    prompt: "Branch to rebase",
  });
  if (!branch) return;
  const onto = await vscode.window.showInputBox({
    prompt: "Onto which branch/commit?",
  });
  if (!onto) return;
  try {
    await client.rebase(branch, onto);
    vscode.window.showInformationMessage(`✅ Rebased ${branch} onto ${onto}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Rebase failed: ${error.message}`);
  }
}

export async function stashHandler(client: GitweClient) {
  const message = await vscode.window.showInputBox({
    prompt: "Stash message (optional)",
  });
  try {
    await client.stashPush(message || undefined);
    vscode.window.showInformationMessage("✅ Changes stashed");
  } catch (error) {
    vscode.window.showErrorMessage(`Stash failed: ${error.message}`);
  }
}

export async function stashPopHandler(client: GitweClient) {
  try {
    await client.stashPop();
    vscode.window.showInformationMessage("✅ Stash popped");
  } catch (error) {
    vscode.window.showErrorMessage(`Stash pop failed: ${error.message}`);
  }
}
