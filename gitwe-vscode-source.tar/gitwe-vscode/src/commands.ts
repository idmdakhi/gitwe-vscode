import * as vscode from "vscode";
import { GitweRepo, GitweCliError, GitweNotFoundError, GitweTypeDefinition } from "./cli";
import { BranchNode } from "./branchesTreeProvider";

export interface CommandContext {
  getRepo: () => GitweRepo | undefined;
  refreshAll: () => void;
}

async function withRepo<T>(
  ctx: CommandContext,
  fn: (repo: GitweRepo) => Promise<T>,
): Promise<T | undefined> {
  const repo = ctx.getRepo();
  if (!repo) {
    void vscode.window.showWarningMessage("gitwe: open a workspace folder first.");
    return undefined;
  }
  try {
    return await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "gitwe", cancellable: false },
      () => fn(repo),
    );
  } catch (err) {
    await reportError(err);
    return undefined;
  } finally {
    ctx.refreshAll();
  }
}

async function reportError(err: unknown): Promise<void> {
  if (err instanceof GitweNotFoundError) {
    const choice = await vscode.window.showErrorMessage(err.message, "Open Settings");
    if (choice) void vscode.commands.executeCommand("workbench.action.openSettings", "gitwe.binaryPath");
    return;
  }
  if (err instanceof GitweCliError) {
    if (err.code === "CONFLICT" && err.files?.length) {
      const choice = await vscode.window.showErrorMessage(
        `gitwe: merge conflict in ${err.files.length} file(s). ${err.message}`,
        "Show Files",
        "Abort",
      );
      if (choice === "Show Files") {
        const doc = await vscode.workspace.openTextDocument({ content: err.files.join("\n"), language: "plaintext" });
        await vscode.window.showTextDocument(doc);
      } else if (choice === "Abort") {
        await vscode.commands.executeCommand("gitwe.abort");
      }
      return;
    }
    const detail = err.hint ? `${err.message}\n${err.hint}` : err.message;
    void vscode.window.showErrorMessage(`gitwe: ${detail}`);
    return;
  }
  void vscode.window.showErrorMessage(`gitwe: ${err instanceof Error ? err.message : String(err)}`);
}

async function confirmDestructive(message: string): Promise<boolean> {
  if (!vscode.workspace.getConfiguration("gitwe").get<boolean>("confirmDestructiveActions", true)) return true;
  const choice = await vscode.window.showWarningMessage(message, { modal: true }, "Continue");
  return choice === "Continue";
}

function branchQuickPickItems(types: GitweTypeDefinition[]): (vscode.QuickPickItem & { type: GitweTypeDefinition })[] {
  return types.map((t) => ({
    type: t,
    label: `$(git-branch) ${t.name}`,
    description: `${t.prefix}<name> → ${t.target.join(", ")}`,
    detail: `base: ${t.base}${t.aliases.length ? `  ·  aliases: ${t.aliases.join(", ")}` : ""}`,
  }));
}

export function registerCommands(context: vscode.ExtensionContext, cmdCtx: CommandContext): void {
  const { subscriptions } = context;

  subscriptions.push(
    vscode.commands.registerCommand("gitwe.init", async () => {
      const preset = await vscode.window.showQuickPick(
        [
          { label: "classic", description: "git-flow: develop + feature/release/hotfix" },
          { label: "github", description: "GitHub Flow: main + short-lived topic branches" },
          { label: "gitlab", description: "GitLab Flow: main + environment branches" },
        ],
        { title: "gitwe init — choose a preset", placeHolder: "classic" },
      );
      if (!preset) return;
      await withRepo(cmdCtx, (repo) => repo.init(["--preset", preset.label]));
      void vscode.window.showInformationMessage(`gitwe: initialized with the "${preset.label}" preset.`);
    }),

    vscode.commands.registerCommand("gitwe.start", async () => {
      const repo = cmdCtx.getRepo();
      if (!repo) return void vscode.window.showWarningMessage("gitwe: open a workspace folder first.");
      const { types } = await repo.types().catch(() => ({ types: [] as GitweTypeDefinition[] }));
      if (!types.length) {
        void vscode.window.showWarningMessage("gitwe: no topic types configured. Run `gitwe init` first.");
        return;
      }
      const picked = await vscode.window.showQuickPick(branchQuickPickItems(types), {
        title: "gitwe start — branch type",
      });
      if (!picked) return;
      const name = await vscode.window.showInputBox({
        title: `gitwe start ${picked.type.name} — short name`,
        placeHolder: "e.g. login-page",
        validateInput: (v) => (v.trim() ? undefined : "a short name is required"),
      });
      if (!name) return;
      await withRepo(cmdCtx, (r) => r.start(picked.type.name, name.trim(), undefined));
      void vscode.window.showInformationMessage(`gitwe: started ${picked.type.prefix}${name.trim()}`);
    }),

    vscode.commands.registerCommand("gitwe.finishCurrent", () => finishBranch(cmdCtx, undefined)),
    vscode.commands.registerCommand("gitwe.finishBranchByName", (branch: string) => finishBranch(cmdCtx, branch)),

    vscode.commands.registerCommand("gitwe.updateCurrent", async () => {
      const rebase = await pickMergeOrRebase("gitwe update");
      if (rebase === undefined) return;
      await withRepo(cmdCtx, (repo) => repo.update(undefined, rebase ? ["--rebase"] : []));
    }),

    vscode.commands.registerCommand("gitwe.sync", async () => {
      await withRepo(cmdCtx, (repo) => repo.sync());
    }),

    vscode.commands.registerCommand("gitwe.pull", async () => {
      await withRepo(cmdCtx, (repo) => repo.pull());
    }),

    vscode.commands.registerCommand("gitwe.publishCurrent", async () => {
      await withRepo(cmdCtx, (repo) => repo.publish(undefined));
    }),

    vscode.commands.registerCommand("gitwe.deleteCurrent", () => deleteBranch(cmdCtx, undefined)),

    vscode.commands.registerCommand("gitwe.rename", async () => {
      const newName = await vscode.window.showInputBox({
        title: "gitwe rename — new short name",
        validateInput: (v) => (v.trim() ? undefined : "a name is required"),
      });
      if (!newName) return;
      await withRepo(cmdCtx, (repo) => repo.rename(newName.trim()));
    }),

    vscode.commands.registerCommand("gitwe.checkout", async () => {
      const repo = cmdCtx.getRepo();
      if (!repo) return void vscode.window.showWarningMessage("gitwe: open a workspace folder first.");
      const { branches } = await repo.list().catch(() => ({ branches: [] }));
      if (!branches.length) {
        void vscode.window.showInformationMessage("gitwe: no topic branches to check out.");
        return;
      }
      const picked = await vscode.window.showQuickPick(
        branches.map((b) => ({ label: b.branch, description: b.type })),
        { title: "gitwe checkout" },
      );
      if (!picked) return;
      await withRepo(cmdCtx, (r) => r.checkout(picked.label));
    }),

    vscode.commands.registerCommand("gitwe.checkoutBranchByName", async (branch: string) => {
      await withRepo(cmdCtx, (repo) => repo.checkout(branch));
    }),

    vscode.commands.registerCommand("gitwe.track", async () => {
      const branch = await vscode.window.showInputBox({
        title: "gitwe track — remote branch or type",
        placeHolder: "feature/login  or  feature",
        validateInput: (v) => (v.trim() ? undefined : "required"),
      });
      if (!branch) return;
      let name: string | undefined;
      if (!branch.includes("/")) {
        name = await vscode.window.showInputBox({ title: "short name", validateInput: (v) => (v.trim() ? undefined : "required") });
        if (!name) return;
      }
      await withRepo(cmdCtx, (repo) => repo.track(branch.trim(), name?.trim()));
    }),

    vscode.commands.registerCommand("gitwe.tag", async () => {
      const name = await vscode.window.showInputBox({ title: "tag name", placeHolder: "v1.2.0" });
      if (!name) return;
      const message = await vscode.window.showInputBox({ title: "tag message (optional)" });
      const push = await vscode.window.showQuickPick(["Yes", "No"], { title: "push the tag?" });
      const extraArgs = [...(message ? ["-m", message] : []), ...(push === "Yes" ? ["--push"] : [])];
      await withRepo(cmdCtx, (repo) => repo.tag(name.trim(), extraArgs));
    }),

    vscode.commands.registerCommand("gitwe.rebase", async () => {
      await withRepo(cmdCtx, (repo) => repo.rebase(undefined, ["--fetch"]));
    }),

    vscode.commands.registerCommand("gitwe.abort", async () => {
      if (!(await confirmDestructive("Abort the in-progress gitwe finish and roll back all changes it made?"))) return;
      await withRepo(cmdCtx, (repo) => repo.abort());
    }),

    vscode.commands.registerCommand("gitwe.doctor", () => runDoctor(cmdCtx, false)),
    vscode.commands.registerCommand("gitwe.doctorFix", () => runDoctor(cmdCtx, true)),

    vscode.commands.registerCommand("gitwe.validate", async () => {
      const result = await withRepo(cmdCtx, (repo) => repo.validate());
      if (!result) return;
      if (result.valid) {
        void vscode.window.showInformationMessage("gitwe: workflow definition is valid.");
      } else {
        const doc = await vscode.workspace.openTextDocument({
          content: result.issues.map((i) => `${i.path}: ${i.message}`).join("\n"),
          language: "plaintext",
        });
        await vscode.window.showTextDocument(doc);
      }
    }),

    vscode.commands.registerCommand("gitwe.graph", async () => {
      const repo = cmdCtx.getRepo();
      if (!repo) return;
      try {
        const output = await repo.graph();
        const doc = await vscode.workspace.openTextDocument({ content: output, language: "plaintext" });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (err) {
        await reportError(err);
      }
    }),

    vscode.commands.registerCommand("gitwe.log", async () => {
      const repo = cmdCtx.getRepo();
      if (!repo) return;
      try {
        const output = await repo.log();
        const doc = await vscode.workspace.openTextDocument({ content: output, language: "plaintext" });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (err) {
        await reportError(err);
      }
    }),

    vscode.commands.registerCommand("gitwe.refreshBranches", () => cmdCtx.refreshAll()),

    // ---- Tree view item actions -------------------------------------------------
    vscode.commands.registerCommand("gitwe.branch.checkout", async (node: BranchNode) => {
      await withRepo(cmdCtx, (repo) => repo.checkout(node.branch.branch));
    }),
    vscode.commands.registerCommand("gitwe.branch.update", async (node: BranchNode) => {
      await withRepo(cmdCtx, (repo) => repo.update(node.branch.branch));
    }),
    vscode.commands.registerCommand("gitwe.branch.publish", async (node: BranchNode) => {
      await withRepo(cmdCtx, (repo) => repo.publish(node.branch.branch));
    }),
    vscode.commands.registerCommand("gitwe.branch.finish", async (node: BranchNode) => finishBranch(cmdCtx, node.branch.branch)),
    vscode.commands.registerCommand("gitwe.branch.rename", async (node: BranchNode) => {
      const newName = await vscode.window.showInputBox({
        title: `Rename ${node.branch.branch}`,
        value: node.branch.shortName,
        validateInput: (v) => (v.trim() ? undefined : "a name is required"),
      });
      if (!newName || newName === node.branch.shortName) return;
      if (node.isCurrent) {
        await withRepo(cmdCtx, (repo) => repo.rename(newName.trim()));
        return;
      }
      await withRepo(cmdCtx, async (repo) => {
        await repo.checkout(node.branch.branch);
        await repo.rename(newName.trim());
      });
    }),
    vscode.commands.registerCommand("gitwe.branch.delete", async (node: BranchNode) => deleteBranch(cmdCtx, node.branch.branch)),
  );

  async function finishBranch(ctx: CommandContext, branch: string | undefined): Promise<void> {
    const label = branch ?? "the current branch";
    const strategy = await vscode.window.showQuickPick(
      [
        { label: "Merge commit", value: [] as string[] },
        { label: "Squash merge", value: ["--squash"] },
        { label: "Rebase, then merge", value: ["--rebase"] },
      ],
      { title: `gitwe finish ${label} — merge strategy` },
    );
    if (!strategy) return;
    const push = await vscode.window.showQuickPick(["Yes", "No"], { title: "push after finishing?" });
    if (!push) return;
    const args = [...strategy.value, ...(push === "Yes" ? ["--push"] : [])];
    await withRepo(ctx, (repo) => repo.finish(branch, args));
  }

  async function deleteBranch(ctx: CommandContext, branch: string | undefined): Promise<void> {
    const label = branch ?? "the current branch";
    if (!(await confirmDestructive(`Delete ${label}? This cannot be undone from within gitwe.`))) return;
    const alsoRemote = await vscode.window.showQuickPick(["Local only", "Local + remote"], {
      title: `gitwe delete ${label}`,
    });
    if (!alsoRemote) return;
    await withRepo(ctx, (repo) => repo.deleteBranch(branch, alsoRemote === "Local + remote" ? ["--remote"] : []));
  }

  async function pickMergeOrRebase(title: string): Promise<boolean | undefined> {
    const choice = await vscode.window.showQuickPick(["Merge", "Rebase"], { title });
    if (!choice) return undefined;
    return choice === "Rebase";
  }

  async function runDoctor(ctx: CommandContext, fix: boolean): Promise<void> {
    const repo = ctx.getRepo();
    if (!repo) return void vscode.window.showWarningMessage("gitwe: open a workspace folder first.");
    try {
      const report = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "gitwe doctor" },
        () => repo.doctor(fix),
      );
      const errors = report.findings.filter((f) => f.severity === "error").length;
      const warnings = report.findings.filter((f) => f.severity === "warning").length;
      const summary =
        errors === 0 && warnings === 0
          ? "gitwe: workflow looks healthy."
          : `gitwe doctor: ${errors} error(s), ${warnings} warning(s)${report.fixed?.length ? `, fixed ${report.fixed.length}` : ""}.`;
      if (errors > 0) void vscode.window.showErrorMessage(summary, "Open Dashboard").then((c) => c && vscode.commands.executeCommand("gitwe.openDashboard"));
      else void vscode.window.showInformationMessage(summary);
    } catch (err) {
      await reportError(err);
    } finally {
      ctx.refreshAll();
    }
  }
}
