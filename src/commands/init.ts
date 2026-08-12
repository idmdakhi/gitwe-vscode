import * as vscode from "vscode";
import * as path from "node:path";
import type { WorkflowConfig } from "gitwe-ts";
import { loadGitwe } from "../gitweModule";
import { getSettings, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";
import { createOutputChannelLogger } from "../outputChannel";

function nonEmpty(value: string): string | undefined {
  return value.trim() ? undefined : "Required";
}

/** Renames a base branch everywhere it's referenced (other base branches' `base`, and every branch type's `base`/`target`). */
function renameBaseBranch(
  config: WorkflowConfig,
  oldName: string,
  newName: string,
): void {
  const base = config.baseBranches.find((b) => b.name === oldName);
  if (base) base.name = newName;
  for (const b of config.baseBranches) {
    if (b.base === oldName) b.base = newName;
  }
  for (const type of config.branchTypes) {
    if (type.base === oldName) type.base = newName;
    type.target = type.target.map((t) => (t === oldName ? newName : t));
  }
}

/**
 * Full "Initialize repository" wizard, VS Code-native (no terminal prompts
 * needed) — asks for every base branch name and every branch type's prefix
 * individually (the way vscode-gitflow's "Initialize repository for
 * gitflow" flow does), plus an optional standalone "bugfix" branch type,
 * remote name, tag prefix, versioning, and changelog generation.
 */
export async function initWorkflowCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const gitwe = await loadGitwe();
    const root = folder.uri.fsPath;

    const existing = gitwe.findConfigFile(root, root);
    if (existing) {
      const overwrite = await vscode.window.showWarningMessage(
        `Gitwe: "${path.relative(root, existing)}" already exists. Overwrite it?`,
        { modal: true },
        "Overwrite",
      );
      if (overwrite !== "Overwrite") return;
    }

    const presetPick = await vscode.window.showQuickPick(
      gitwe.PRESET_NAMES.map((name) => ({ label: name })),
      {
        title: "Gitwe: Initialize (1/7) — choose a preset",
        placeHolder: getSettings().workflow,
      },
    );
    if (!presetPick) return;

    // A fresh, freely-mutable draft config for the chosen preset — every
    // remaining step edits this object directly rather than going through
    // gitwe's override plumbing (which only covers a handful of fields).
    const config = gitwe.createPreset(presetPick.label, {}, root);

    // 2) Base branch names (main, develop, ...)
    for (const base of [...config.baseBranches]) {
      const oldName = base.name;
      const answer = await vscode.window.showInputBox({
        title: `Gitwe: Initialize (2/7) — branch name for "${oldName}"${base.base ? ` (based on ${base.base})` : " (root)"}`,
        value: oldName,
        validateInput: nonEmpty,
      });
      if (answer === undefined) return;
      const trimmed = answer.trim();
      if (trimmed !== oldName) renameBaseBranch(config, oldName, trimmed);
    }

    // 3) Prefix for every branch type (feature/, release/, hotfix/, ...)
    for (const type of config.branchTypes) {
      const answer = await vscode.window.showInputBox({
        title: `Gitwe: Initialize (3/7) — prefix for "${type.name}" branches`,
        value: type.prefix,
        validateInput: nonEmpty,
      });
      if (answer === undefined) return;
      type.prefix = answer.trim();
    }

    // 4) Optional standalone "bugfix" branch type (vscode-gitflow supports this
    // alongside "feature"; gitwe's built-in presets don't define it by default).
    if (!config.branchTypes.some((t) => t.name === "bugfix")) {
      const addBugfix = await vscode.window.showQuickPick(["No", "Yes"], {
        title: 'Gitwe: Initialize (4/7) — add a separate "bugfix" branch type?',
      });
      if (!addBugfix) return;
      if (addBugfix === "Yes") {
        const like =
          config.branchTypes.find((t) => t.name === "feature") ??
          config.branchTypes[0];
        const prefix = await vscode.window.showInputBox({
          title: 'Gitwe: Initialize (4/7) — prefix for "bugfix" branches',
          value: "bugfix/",
          validateInput: nonEmpty,
        });
        if (prefix === undefined) return;
        config.branchTypes.push({
          name: "bugfix",
          base: like.base,
          target: [...like.target],
          prefix: prefix.trim(),
        });
      }
    }

    // 5) Remote name
    const remote = await vscode.window.showInputBox({
      title: "Gitwe: Initialize (5/7) — remote name",
      value: config.remote?.name ?? "origin",
      validateInput: nonEmpty,
    });
    if (remote === undefined) return;
    config.remote = {
      ...(config.remote ?? { name: "origin" }),
      name: remote.trim(),
    };

    // 6) Version tag prefix + enable versioning
    const tagPrefix = await vscode.window.showInputBox({
      title:
        "Gitwe: Initialize (6/7) — version tag prefix (leave blank for none)",
      value: config.versioning?.tagPrefix ?? "v",
    });
    if (tagPrefix === undefined) return;
    const versioningPick = await vscode.window.showQuickPick(["No", "Yes"], {
      title:
        "Gitwe: Initialize (6/7) — enable versioning (tag + bump package.json on Finish)?",
    });
    if (!versioningPick) return;
    config.versioning = {
      enabled: versioningPick === "Yes",
      tagPrefix: tagPrefix.trim() || "v",
      tag: config.versioning?.tag ?? [],
      branchTypes: config.versioning?.branchTypes,
      initialVersion: config.versioning?.initialVersion,
      format: config.versioning?.format,
      annotated: config.versioning?.annotated,
      pushTags: config.versioning?.pushTags,
      changelog: config.versioning?.changelog,
    };

    // 7) Changelog generation on Finish
    const changelogPick = await vscode.window.showQuickPick(["No", "Yes"], {
      title:
        "Gitwe: Initialize (7/7) — generate/update CHANGELOG.md on Finish?",
    });
    if (!changelogPick) return;
    config.versioning.changelog = {
      enabled: changelogPick === "Yes",
      path: config.versioning.changelog?.path ?? "CHANGELOG.md",
    };

    // Re-validate the fully edited config before writing it to disk.
    const validated = gitwe.parseWorkflowConfig(
      JSON.parse(JSON.stringify(config)),
    );

    const target = path.join(root, gitwe.DEFAULT_CONFIG_FILE);
    gitwe.writeConfigFile(target, validated);
    outputChannel.appendLine(`[INFO] wrote ${target}`);

    const engine = await gitwe.createEngine({
      root,
      config: validated,
      configPath: target,
      logger: createOutputChannelLogger(outputChannel),
    });
    const created = await engine.createMissingBaseBranches();
    for (const branch of created)
      outputChannel.appendLine(`[INFO] created branch ${branch}`);

    void vscode.window.showInformationMessage(
      `Gitwe: initialized "${presetPick.label}" workflow${created.length > 0 ? ` — created ${created.join(", ")}` : ""}.`,
    );
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(target),
    );
    await vscode.window.showTextDocument(doc);
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
