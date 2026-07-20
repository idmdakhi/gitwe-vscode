import * as vscode from "vscode";
import { GitweClient } from "./gitwe/client";
import { BranchesTreeProvider } from "./providers/branchesTree";
import { GraphWebView } from "./providers/graphWebView";
import { StatusBarProvider } from "./providers/statusBar";
import { getConfig, onDidChangeConfig } from "./config/settings";
import * as commands from "./commands";
import { WebGuiServer } from "./webgui/server";

let client: GitweClient;
let treeProvider: BranchesTreeProvider;
let statusBar: StatusBarProvider;
let refreshInterval: NodeJS.Timeout | undefined;

let webGuiServer: WebGuiServer | undefined;

export async function activate(context: vscode.ExtensionContext) {
  // ایجاد کلاینت Gitwe
  client = new GitweClient(context);
  await client.initialize();

  // ارائه‌دهنده TreeView
  treeProvider = new BranchesTreeProvider(client);
  const treeView = vscode.window.createTreeView("gitwe-branches", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // نوار وضعیت
  statusBar = new StatusBarProvider(client);
  context.subscriptions.push(statusBar);

  // ثبت تمام دستورات
  const commandMap = {
    "gitwe.start": commands.startHandler,
    "gitwe.finish": commands.finishHandler,
    "gitwe.status": commands.statusHandler,
    "gitwe.graph": commands.graphHandler,
    "gitwe.current": commands.currentHandler,
    "gitwe.list": commands.listHandler,
    "gitwe.types": commands.typesHandler,
    "gitwe.validate": commands.validateHandler,
    "gitwe.doctor": commands.doctorHandler,
    "gitwe.config": commands.configHandler,
    "gitwe.checkout": commands.checkoutHandler,
    "gitwe.refresh": commands.refreshHandler,
  };

  for (const [id, handler] of Object.entries(commandMap)) {
    const disposable = vscode.commands.registerCommand(id, (...args) =>
      handler(client, treeProvider, statusBar, ...args),
    );
    context.subscriptions.push(disposable);
  }

  // گوش‌دادن به تغییرات تنظیمات
  context.subscriptions.push(
    onDidChangeConfig(() => {
      statusBar.update();
      treeProvider.refresh();
      setupAutoRefresh(context);
    }),
  );

  // راه‌اندازی تازه‌سازی خودکار
  setupAutoRefresh(context);

  // نمایش پیام خوش‌آمد
  vscode.window.showInformationMessage("Gitwe VSCode extension activated!");

  // ثبت دستور برای راه‌اندازی WebGUI
  const startWebGui = vscode.commands.registerCommand(
    "gitwe.startWebGui",
    async () => {
      if (webGuiServer) {
        vscode.window.showInformationMessage(
          `WebGUI already running on http://localhost:${webGuiServer.getPort()}`,
        );
        return;
      }
      try {
        webGuiServer = new WebGuiServer(client, 5678);
        await webGuiServer.start();
        vscode.window.showInformationMessage(
          `🌐 WebGUI started at http://localhost:5678`,
        );
        // باز کردن در مرورگر پیش‌فرض
        vscode.env.openExternal(vscode.Uri.parse("http://localhost:5678"));
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to start WebGUI: ${error.message}`,
        );
      }
    },
  );
  context.subscriptions.push(startWebGui);

  // دستور توقف WebGUI
  const stopWebGui = vscode.commands.registerCommand("gitwe.stopWebGui", () => {
    if (webGuiServer) {
      webGuiServer.stop();
      webGuiServer = undefined;
      vscode.window.showInformationMessage("WebGUI stopped");
    } else {
      vscode.window.showWarningMessage("WebGUI is not running");
    }
  });
  context.subscriptions.push(stopWebGui);
}

function setupAutoRefresh(context: vscode.ExtensionContext) {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }

  const config = getConfig();
  const interval = config.refreshInterval || 0;
  if (interval > 0) {
    refreshInterval = setInterval(() => {
      treeProvider.refresh();
      statusBar.update();
    }, interval);
    context.subscriptions.push({
      dispose: () => clearInterval(refreshInterval),
    });
  }
}

export function deactivate() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  statusBar?.dispose();
}
