import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

interface MenuAction {
  label: string;
  description?: string;
  run: () => unknown;
}

/**
 * The single contextual entry point (Command Palette title "Gitwe: Menu...",
 * default keybinding, and the status bar item's click target). Shows branch
 * types as a first-level Quick Pick, then git-flow-style actions
 * (Start/Finish/Publish/Update/Track/Delete/Checkout) for the chosen type —
 * mirroring vscode-gitflow's per-type submenus, but driven by whatever
 * branch types the active workflow actually defines.
 */
export async function openGitweMenuCommand(outputChannel: vscode.OutputChannel, onDone: () => void): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const current = await engine.git.currentBranch();

    const topLevel: MenuAction[] = [
      ...engine.workflow.branchTypes.map((type) => ({
        label: `$(folder) ${type.name}`,
        description: `${type.prefix}* → ${type.target.join(", ") || "(none)"}`,
        run: () => vscode.commands.executeCommand("gitwe.branchTypeMenu", type.name),
      })),
      { label: "$(git-branch) Base branches", description: "checkout / sync main, develop, …", run: () => vscode.commands.executeCommand("gitwe.baseBranchMenu") },
      { label: "$(tag) Tags", description: "list / push / delete", run: () => vscode.commands.executeCommand("gitwe.tagMenu") },
      { label: "$(dashboard) Open Dashboard", run: () => vscode.commands.executeCommand("gitwe.openDashboard") },
      { label: "$(pulse) Show Status", run: () => vscode.commands.executeCommand("gitwe.status") },
      { label: "$(checklist) Run Doctor", run: () => vscode.commands.executeCommand("gitwe.doctor") },
    ];

    const picked = await vscode.window.showQuickPick(topLevel, {
      title: `Gitwe${current ? ` — on ${current}` : ""}`,
      placeHolder: "Choose a branch type or action",
    });
    await picked?.run();
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}

export async function branchTypeMenuCommand(
  outputChannel: vscode.OutputChannel,
  onDone: () => void,
  typeName?: string,
): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);

    let name = typeName;
    if (!name) {
      const picked = await vscode.window.showQuickPick(
        engine.workflow.branchTypes.map((t) => t.name),
        { placeHolder: "Branch type", title: "Gitwe" },
      );
      if (!picked) return;
      name = picked;
    }
    const type = engine.workflow.requireBranchType(name);

    const branches = await engine.listBranchTypes(type);
    const branchLabel = branches.length > 0 ? ` (${branches.length})` : "";

    const actions: MenuAction[] = [
      { label: "$(add) Start", run: () => vscode.commands.executeCommand("gitwe.start") },
      { label: `$(check) Finish${branchLabel}`, run: () => vscode.commands.executeCommand("gitwe.finish") },
      { label: `$(cloud-upload) Publish${branchLabel}`, run: () => vscode.commands.executeCommand("gitwe.publish") },
      { label: `$(sync) Update from base${branchLabel}`, run: () => vscode.commands.executeCommand("gitwe.update") },
      { label: "$(cloud-download) Track remote branch", run: () => vscode.commands.executeCommand("gitwe.track") },
      { label: `$(arrow-swap) Checkout${branchLabel}`, run: () => vscode.commands.executeCommand("gitwe.checkoutBranch") },
      { label: `$(trash) Delete${branchLabel}`, run: () => vscode.commands.executeCommand("gitwe.deleteBranch") },
    ];

    const picked = await vscode.window.showQuickPick(actions, {
      title: `Gitwe: ${type.name}`,
      placeHolder: `${type.prefix}* → ${type.target.join(", ") || "(none)"}`,
    });
    await picked?.run();
    onDone();
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}

export async function baseBranchMenuCommand(onDone: () => void): Promise<void> {
  const actions: MenuAction[] = [
    { label: "$(arrow-swap) Checkout base branch", run: () => vscode.commands.executeCommand("gitwe.checkoutBase") },
    { label: "$(sync) Fetch && sync all base branches", run: () => vscode.commands.executeCommand("gitwe.syncBase") },
  ];
  const picked = await vscode.window.showQuickPick(actions, { title: "Gitwe: Base branches" });
  await picked?.run();
  onDone();
}

export async function tagMenuCommand(onDone: () => void): Promise<void> {
  const actions: MenuAction[] = [
    { label: "$(list-unordered) List tags", run: () => vscode.commands.executeCommand("gitwe.listTags") },
    { label: "$(cloud-upload) Push a tag", run: () => vscode.commands.executeCommand("gitwe.pushTag") },
    { label: "$(trash) Delete a tag", run: () => vscode.commands.executeCommand("gitwe.deleteTag") },
  ];
  const picked = await vscode.window.showQuickPick(actions, { title: "Gitwe: Tags" });
  await picked?.run();
  onDone();
}
