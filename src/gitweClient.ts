import * as vscode from "vscode";
import * as path from "node:path";
import { existsSync } from "node:fs";
import type { Engine, BranchType, BranchStatus } from "gitwe";
import { loadGitwe } from "./gitweModule";
import { createOutputChannelLogger } from "./outputChannel";

export interface GitweSettings {
  /** Built-in preset name (classic | github | gitlab), used when no workflow file exists yet. */
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
    workflow: cfg.get<string>("workflow", "classic"),
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

/** Walks up from `startDir` looking for a `.git` directory (or file, for worktrees/submodules). */
function findRepositoryRoot(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Builds a fresh gitwe `Engine` for a workspace folder. Construction is cheap
 * (at most one config file read), so we don't cache instances — this way a
 * settings change or a `.git/HEAD` change always takes effect on the very
 * next command without needing an explicit "reload" step.
 *
 * If the repository hasn't been initialized with `gitwe init` yet (no
 * `gitwe.json`/`.gitwe/gitwe.yaml` on disk) we fall back to the built-in
 * preset selected in settings, evaluated in-memory, so the extension is
 * still useful before the user runs `init`.
 */
export async function getEngine(
  folder: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel,
): Promise<Engine> {
  const gitwe = await loadGitwe();
  const settings = getSettings();
  const root = findRepositoryRoot(folder.uri.fsPath) ?? folder.uri.fsPath;
  const logger = createOutputChannelLogger(outputChannel);

  let config;
  let configPath: string | undefined;
  try {
    const loaded = gitwe.loadConfig({
      cwd: root,
      configPath: settings.configPath || undefined,
      root,
    });
    config = loaded.config;
    configPath = loaded.path;
  } catch (error) {
    // An explicit configPath the user asked for should surface its own error.
    if (settings.configPath || !(error instanceof gitwe.NotInitializedError)) throw error;
    config = gitwe.createPreset(settings.workflow, {}, root);
  }

  return gitwe.createEngine({ root, config, logger, configPath });
}

export interface TopicBranch extends BranchStatus {
  typeName: string;
}

/** Flattens every topic branch across all configured branch types. */
export async function listTopicBranches(engine: Engine): Promise<TopicBranch[]> {
  const result: TopicBranch[] = [];
  for (const type of engine.workflow.branchTypes) {
    const statuses = await engine.listBranchTypes(type);
    for (const status of statuses) {
      result.push({ ...status, typeName: type.name });
    }
  }
  return result;
}

/** Resolves a plain branch name (e.g. `feature/login`) back to its branch type, if any. */
export function resolveBranchType(engine: Engine, branchName: string): BranchType | undefined {
  return engine.workflow.resolveBranch(branchName)?.type;
}
