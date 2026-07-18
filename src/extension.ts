// vscode-extension/src/extension.ts
import * as vscode from "vscode";
import {
  WorkflowEngine,
  ShellGitAdapter,
  gitFlowDefinition,
} from "gitflow-engine";
import { getGitRoot, createEngine } from "./utils";
import { BranchTreeProvider } from "./providers/BranchTreeProvider";
import { updateStatusBar } from "./statusBar";

// دستورات
import { showCurrentBranch } from "./commands/current";
import { listBranches } from "./commands/list";
import { startBranch } from "./commands/start";
import { finishBranch } from "./commands/finish";
import { showTypes } from "./commands/types";
import { showStatus } from "./commands/status";

export function activate(context: vscode.ExtensionContext) {
  console.log("gitflow-engine extension is now active!");

  // ثبت دستورات
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "gitflow-engine.current",
      showCurrentBranch,
    ),
    vscode.commands.registerCommand("gitflow-engine.list", listBranches),
    vscode.commands.registerCommand("gitflow-engine.start", startBranch),
    vscode.commands.registerCommand("gitflow-engine.finish", finishBranch),
    vscode.commands.registerCommand("gitflow-engine.types", showTypes),
    vscode.commands.registerCommand("gitflow-engine.status", showStatus),
  );

  // نمایش درخت شاخه‌ها در Sidebar
  const treeProvider = new BranchTreeProvider();
  vscode.window.registerTreeDataProvider("gitflowEngineBranches", treeProvider);
  context.subscriptions.push(treeProvider);

  // نوار وضعیت
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = "gitflow-engine.current";
  context.subscriptions.push(statusBarItem);

  // به‌روزرسانی اولیه
  updateStatusBar(statusBarItem);

  // گوش‌دادن به تغییرات
  vscode.workspace.onDidChangeWorkspaceFolders(() => {
    updateStatusBar(statusBarItem);
  });
}

export function deactivate() {}
