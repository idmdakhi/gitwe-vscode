import * as vscode from "vscode";

export interface GitweConfig {
  workflow: "git-flow" | "github-flow" | "trunk-based";
  configPath: string;
  autoPush: boolean;
  defaultDelete: boolean;
  showStatusBar: boolean;
  refreshInterval: number;
}

export function getConfig(): GitweConfig {
  const config = vscode.workspace.getConfiguration("gitwe");
  return {
    workflow: config.get<"git-flow" | "github-flow" | "trunk-based">(
      "workflow",
      "git-flow",
    ),
    configPath: config.get<string>("configPath", ""),
    autoPush: config.get<boolean>("autoPush", false),
    defaultDelete: config.get<boolean>("defaultDelete", true),
    showStatusBar: config.get<boolean>("showStatusBar", true),
    refreshInterval: config.get<number>("refreshInterval", 30000),
  };
}

export function onDidChangeConfig(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("gitwe")) {
      callback();
    }
  });
}
