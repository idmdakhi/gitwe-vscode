import * as vscode from "vscode";
import { Container, type ContainerOptions } from "gitwe";
import { createOutputChannelLogger } from "./outputChannel";

export interface GitweSettings {
  workflow: string;
  configPath: string;
  defaultRootBranch: string;
  deleteAfterFinish: boolean;
  pushAfterFinish: boolean;
  confirmFinish: boolean;
}

export function getSettings(): GitweSettings {
  const cfg = vscode.workspace.getConfiguration("gitwe");
  return {
    workflow: cfg.get<string>("workflow", "git-flow"),
    configPath: cfg.get<string>("configPath", ""),
    defaultRootBranch: cfg.get<string>("defaultRootBranch", "main"),
    deleteAfterFinish: cfg.get<boolean>("deleteAfterFinish", true),
    pushAfterFinish: cfg.get<boolean>("pushAfterFinish", false),
    confirmFinish: cfg.get<boolean>("confirmFinish", true),
  };
}

/**
 * Picks the workspace folder to operate on. For multi-root workspaces,
 * prefers whichever folder contains the currently active editor's file.
 */
export function pickWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  if (folders.length === 1) return folders[0];

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const match = vscode.workspace.getWorkspaceFolder(activeUri);
    if (match) return match;
  }
  return folders[0];
}

/**
 * Builds a fresh `Container` for a workspace folder. Construction is cheap
 * (at most one config file read), so we don't cache instances — this way
 * a settings change or a `.git/HEAD` change always takes effect on the
 * very next command without needing an explicit "reload" step.
 */
export function getContainer(folder: vscode.WorkspaceFolder, outputChannel: vscode.OutputChannel): Container {
  const settings = getSettings();
  const options: ContainerOptions = {
    cwd: folder.uri.fsPath,
    builtIn: settings.workflow,
    logger: createOutputChannelLogger(outputChannel),
  };
  if (settings.configPath) {
    options.configPath = settings.configPath;
  }
  return new Container(options);
}
