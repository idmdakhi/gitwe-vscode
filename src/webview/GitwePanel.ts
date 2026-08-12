import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { showGitweError } from "../util/errors";

interface DashboardBaseBranch {
  name: string;
  base: string | undefined;
  exists: boolean;
  current: boolean;
  ahead: number;
  behind: number;
}

interface DashboardBranchType {
  name: string;
  prefix: string;
  base: string;
  target: string[];
  branches: string[];
}

interface DashboardHealth {
  level: "ok" | "warning" | "error";
  message: string;
}

interface DashboardData {
  workflowName: string;
  currentBranch: string;
  workingTreeClean: boolean;
  baseBranches: DashboardBaseBranch[];
  branchTypes: DashboardBranchType[];
  health: DashboardHealth[];
  error: string | undefined;
}

type InboundMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "runDoctor" }
  | { type: "start" }
  | { type: "finish"; branch: string }
  | { type: "publish"; branch: string }
  | { type: "update"; branch: string }
  | { type: "rebase"; branch: string }
  | { type: "track" }
  | { type: "pull" }
  | { type: "push" };

/**
 * Singleton webview panel — a visual dashboard on top of the same `Engine`
 * the tree view and commands use. It doesn't duplicate any gitwe logic:
 * mutating actions (start/finish/pull/push) are delegated straight back to
 * the registered VS Code commands, and this panel just re-fetches +
 * re-renders afterwards.
 */
export class GitwePanel {
  private static current: GitwePanel | undefined;

  static show(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel,
  ): void {
    if (GitwePanel.current) {
      GitwePanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "gitweDashboard",
      "Gitwe Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
    GitwePanel.current = new GitwePanel(panel, context, outputChannel);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
  ) {
    this.panel.webview.html = this.renderShell();
    this.panel.onDidDispose(
      () => (GitwePanel.current = undefined),
      null,
      context.subscriptions,
    );
    this.panel.webview.onDidReceiveMessage((message: InboundMessage) =>
      this.handleMessage(message),
    );
  }

  private async handleMessage(message: InboundMessage): Promise<void> {
    switch (message.type) {
      case "ready":
      case "refresh":
        await this.postData();
        return;
      case "runDoctor":
        await vscode.commands.executeCommand("gitwe.doctor");
        await this.postData();
        return;
      case "start":
        await vscode.commands.executeCommand("gitwe.start");
        await this.postData();
        return;
      case "finish":
        await vscode.commands.executeCommand("gitwe.finish", message.branch);
        await this.postData();
        return;
      case "publish":
        await vscode.commands.executeCommand("gitwe.publish", message.branch);
        await this.postData();
        return;
      case "update":
        await vscode.commands.executeCommand("gitwe.update", message.branch);
        await this.postData();
        return;
      case "rebase":
        await vscode.commands.executeCommand("gitwe.rebase", message.branch);
        await this.postData();
        return;
      case "track":
        await vscode.commands.executeCommand("gitwe.track");
        await this.postData();
        return;
      case "pull":
        await vscode.commands.executeCommand("gitwe.pull");
        await this.postData();
        return;
      case "push":
        await vscode.commands.executeCommand("gitwe.push");
        await this.postData();
        return;
    }
  }

  private async postData(): Promise<void> {
    const data = await this.loadData();
    void this.panel.webview.postMessage({ type: "data", payload: data });
  }

  private async loadData(): Promise<DashboardData> {
    const folder = pickWorkspaceFolder();
    const empty: DashboardData = {
      workflowName: "",
      currentBranch: "",
      workingTreeClean: true,
      baseBranches: [],
      branchTypes: [],
      health: [],
      error: undefined,
    };
    if (!folder)
      return { ...empty, error: "Open a folder with a git repository." };

    try {
      const engine = await getEngine(folder, this.outputChannel);
      const [clean, report] = await Promise.all([
        engine.git.isClean(),
        engine.overview(),
      ]);

      return {
        workflowName: report.workflow,
        currentBranch: report.currentBranch ?? "(detached)",
        workingTreeClean: clean,
        baseBranches: report.baseBranches.map((b) => ({
          name: b.name,
          base: b.base,
          exists: b.exists,
          current: b.current,
          ahead: b.ahead,
          behind: b.behind,
        })),
        branchTypes: report.branchTypes.map((t) => ({
          name: t.name,
          prefix: t.prefix,
          base: t.base,
          target: t.target as string[],
          branches: t.branches,
        })),
        health: report.health,
        error: undefined,
      };
    } catch (error) {
      await showGitweError(error, this.outputChannel);
      return {
        ...empty,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private renderShell(): string {
    const nonce = String(Date.now());
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<style>
  :root {
    --gap: 12px;
    --radius: 6px;
    --border: var(--vscode-widget-border, rgba(127,127,127,.35));
  }
  * { box-sizing: border-box; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    padding: 16px 20px 24px;
    margin: 0;
    line-height: 1.45;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap);
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 1.15em;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.72em;
    font-weight: 500;
    letter-spacing: 0.02em;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }
  .pill.clean { background: color-mix(in srgb, #2ea043 22%, transparent); color: #3fb950; }
  .pill.dirty { background: color-mix(in srgb, #d29922 22%, transparent); color: #d29922; }
  .pill.ok { background: color-mix(in srgb, #2ea043 22%, transparent); color: #3fb950; }
  .pill.warning { background: color-mix(in srgb, #d29922 22%, transparent); color: #d29922; }
  .pill.error { background: color-mix(in srgb, #f85149 22%, transparent); color: #f85149; }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 18px;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 14px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  button.secondary:hover {
    filter: brightness(1.08);
  }
  button.ghost {
    background: transparent;
    color: var(--vscode-textLink-foreground);
    padding: 4px 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }

  .card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    background: var(--vscode-editor-background);
  }
  .card h2 {
    margin: 0 0 10px;
    font-size: 0.72em;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.7;
    font-weight: 600;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .branch-name {
    font-size: 1.05em;
    font-weight: 600;
    font-family: var(--vscode-editor-font-family, monospace);
  }

  table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
  th { opacity: 0.65; font-weight: 500; font-size: 0.85em; }
  tr.current td:first-child { color: var(--vscode-textLink-foreground); font-weight: 600; }

  .type-block { margin-bottom: 14px; }
  .type-title {
    font-size: 0.9em;
    margin-bottom: 6px;
    opacity: 0.9;
  }
  .type-title code {
    font-size: 0.85em;
    opacity: 0.7;
  }
  ul.branches {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li.branch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    margin-bottom: 2px;
  }
  li.branch-row:hover {
    background: var(--vscode-list-hoverBackground);
  }
  li.branch-row .name {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em;
  }
  li.branch-row .actions {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  li.branch-row button {
    padding: 2px 8px;
    font-size: 11px;
  }
  .empty {
    opacity: 0.55;
    font-size: 0.9em;
    padding: 4px 0;
  }
  .error-box {
    color: var(--vscode-errorForeground);
    border: 1px solid color-mix(in srgb, var(--vscode-errorForeground) 40%, transparent);
    border-radius: var(--radius);
    padding: 10px 12px;
    margin-bottom: 14px;
  }
  .health-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;
    font-size: 0.9em;
  }
</style>
</head>
<body>
  <header>
    <h1>
      <span>Gitwe</span>
      <span id="workflow-pill" class="pill"></span>
    </h1>
  </header>

  <div id="error" class="error-box" style="display:none"></div>

  <div class="toolbar">
    <button id="start">Start Branch</button>
    <button id="track" class="secondary">Track Remote</button>
    <button id="pull" class="secondary">Pull</button>
    <button id="push" class="secondary">Push</button>
    <button id="doctor" class="secondary">Doctor</button>
    <button id="refresh" class="ghost">Refresh</button>
  </div>

  <div class="grid">
    <section class="card">
      <h2>Status</h2>
      <div id="status" class="status-row"></div>
    </section>
    <section class="card">
      <h2>Health</h2>
      <div id="health"></div>
    </section>
  </div>

  <section class="card" style="margin-top:16px">
    <h2>Base Branches</h2>
    <table>
      <thead>
        <tr><th>Name</th><th>Parent</th><th>Status</th></tr>
      </thead>
      <tbody id="base-body"></tbody>
    </table>
  </section>

  <section class="card" style="margin-top:16px">
    <h2>Topic Branches</h2>
    <div id="types"></div>
  </section>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "style") node.setAttribute("style", v);
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function render(data) {
    const errorBox = document.getElementById("error");
    if (data.error) {
      errorBox.style.display = "block";
      errorBox.textContent = data.error;
    } else {
      errorBox.style.display = "none";
    }

    document.getElementById("workflow-pill").textContent = data.workflowName || "—";

    const status = document.getElementById("status");
    status.innerHTML = "";
    if (data.currentBranch) {
      status.appendChild(el("span", { class: "branch-name", text: data.currentBranch }));
      status.appendChild(
        el("span", {
          class: "pill " + (data.workingTreeClean ? "clean" : "dirty"),
          text: data.workingTreeClean ? "clean" : "dirty",
        }),
      );
    } else {
      status.appendChild(el("span", { class: "empty", text: "No repository" }));
    }

    const health = document.getElementById("health");
    health.innerHTML = "";
    if (!data.health || data.health.length === 0) {
      health.appendChild(el("div", { class: "empty", text: "No checks yet" }));
    } else {
      data.health.forEach((h) => {
        health.appendChild(
          el("div", { class: "health-row" }, [
            el("span", { class: "pill " + h.level, text: h.level }),
            el("span", { text: h.message }),
          ]),
        );
      });
    }

    const baseBody = document.getElementById("base-body");
    baseBody.innerHTML = "";
    (data.baseBranches || []).forEach((b) => {
      const marks = [];
      if (!b.exists) marks.push("missing");
      if (b.ahead > 0) marks.push("↑" + b.ahead);
      if (b.behind > 0) marks.push("↓" + b.behind);
      const tr = el("tr", { class: b.current ? "current" : "" }, [
        el("td", { text: b.name }),
        el("td", { text: b.base || "—" }),
        el("td", { text: marks.join(" · ") || "ok" }),
      ]);
      baseBody.appendChild(tr);
    });

    const types = document.getElementById("types");
    types.innerHTML = "";
    if (!data.branchTypes || data.branchTypes.length === 0) {
      types.appendChild(el("div", { class: "empty", text: "No branch types in workflow" }));
      return;
    }

    data.branchTypes.forEach((t) => {
      const block = el("div", { class: "type-block" });
      block.appendChild(
        el("div", {
          class: "type-title",
          text: t.name + "  ",
        }),
      );
      // prefix line
      const meta = el("div", {
        class: "empty",
        text: t.prefix + "* → " + (t.target.join(", ") || "none"),
        style: "margin-bottom:6px",
      });
      block.appendChild(meta);

      const list = el("ul", { class: "branches" });
      if (!t.branches.length) {
        list.appendChild(el("li", { class: "empty", text: "No branches" }));
      } else {
        t.branches.forEach((name) => {
          const mk = (label, type, secondary) => {
            const b = el("button", {
              text: label,
              class: secondary ? "secondary" : "",
            });
            b.addEventListener("click", () =>
              vscode.postMessage({ type, branch: name }),
            );
            return b;
          };
          const actions = el("span", { class: "actions" }, [
            mk("Finish", "finish", false),
            mk("Publish", "publish", true),
            mk("Update", "update", true),
            mk("Rebase", "rebase", true),
          ]);
          list.appendChild(
            el("li", { class: "branch-row" }, [
              el("span", { class: "name", text: name }),
              actions,
            ]),
          );
        });
      }
      block.appendChild(list);
      types.appendChild(block);
    });
  }

  document.getElementById("start").onclick = () => vscode.postMessage({ type: "start" });
  document.getElementById("track").onclick = () => vscode.postMessage({ type: "track" });
  document.getElementById("pull").onclick = () => vscode.postMessage({ type: "pull" });
  document.getElementById("push").onclick = () => vscode.postMessage({ type: "push" });
  document.getElementById("doctor").onclick = () => vscode.postMessage({ type: "runDoctor" });
  document.getElementById("refresh").onclick = () => vscode.postMessage({ type: "refresh" });

  window.addEventListener("message", (e) => {
    if (e.data?.type === "data") render(e.data.payload);
  });
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }
}
