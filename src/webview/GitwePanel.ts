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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 16px 16px; }
  h1 { font-size: 1.1em; display: flex; align-items: center; gap: 8px; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 0.75em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .clean { background: #2ea04326; color: #2ea043; }
  .dirty { background: #d2992226; color: #d29922; }
  .ok { background: #2ea04326; color: #2ea043; }
  .warning { background: #d2992226; color: #d29922; }
  .error { background: #f8514926; color: #f85149; }
  section { margin: 18px 0; }
  h2 { font-size: 0.95em; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.75; margin-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--vscode-widget-border, #444); font-size: 0.9em; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 2px; cursor: pointer; margin-right: 8px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  ul.branches { list-style: none; margin: 4px 0 0; padding-left: 18px; }
  li.branch-row { display: flex; align-items: center; justify-content: space-between; padding: 2px 0; }
  li.branch-row button { padding: 2px 8px; font-size: 0.8em; margin: 0; }
  .current { font-weight: 600; color: var(--vscode-textLink-foreground); }
  .error-box { color: var(--vscode-errorForeground); }
  .toolbar { display: flex; gap: 8px; margin-bottom: 14px; }
  .health-row { padding: 2px 0; }
</style>
</head>
<body>
  <h1>🌿 Gitwe Dashboard <span id="workflow-pill" class="pill"></span></h1>
  <div id="error" class="error-box" style="display:none"></div>

  <div class="toolbar">
    <button id="start">Start Branch</button>
    <button id="pull" class="secondary">Pull</button>
    <button id="push" class="secondary">Push</button>
    <button id="doctor" class="secondary">Run Doctor</button>
    <button id="refresh" class="secondary">Refresh</button>
    <button id="track" class="secondary">Track Remote</button>
  </div>

  <section>
    <h2>Status</h2>
    <div id="status"></div>
  </section>

  <section>
    <h2>Health</h2>
    <div id="health"></div>
  </section>

  <section>
    <h2>Base Branches</h2>
    <table id="base-table">
      <thead><tr><th>Name</th><th>Parent</th><th>Status</th></tr></thead>
      <tbody id="base-body"></tbody>
    </table>
  </section>

  <section>
    <h2>Branch Types</h2>
    <div id="types"></div>
  </section>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    });
    children.forEach((c) => node.appendChild(c));
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

    document.getElementById("workflow-pill").textContent = data.workflowName || "";

    const status = document.getElementById("status");
    status.innerHTML = "";
    if (data.currentBranch) {
      status.appendChild(el("div", { text: "Branch: " + data.currentBranch }));
      status.appendChild(
        el("span", {
          class: "pill " + (data.workingTreeClean ? "clean" : "dirty"),
          text: data.workingTreeClean ? "clean" : "uncommitted changes",
        }),
      );
    }

    const health = document.getElementById("health");
    health.innerHTML = "";
    (data.health || []).forEach((h) => {
      const row = el("div", { class: "health-row" }, [
        el("span", { class: "pill " + h.level, text: h.level }),
        el("span", { text: " " + h.message }),
      ]);
      health.appendChild(row);
    });

    const baseBody = document.getElementById("base-body");
    baseBody.innerHTML = "";
    (data.baseBranches || []).forEach((b) => {
      const marks = [];
      if (!b.exists) marks.push("missing");
      if (b.ahead > 0) marks.push("↑" + b.ahead);
      if (b.behind > 0) marks.push("↓" + b.behind);
      const tr = el("tr", {}, [
        el("td", { text: b.name, class: b.current ? "current" : "" }),
        el("td", { text: b.base || "—" }),
        el("td", { text: marks.join(", ") || "ok" }),
      ]);
      baseBody.appendChild(tr);
    });

    const types = document.getElementById("types");
    types.innerHTML = "";
    (data.branchTypes || []).forEach((t) => {
      const section = el("div", {}, [
        el("div", { text: t.name + " (" + t.prefix + " → " + (t.target.join(", ") || "none") + ")" }),
      ]);
      const list = el("ul", { class: "branches" });
      if (t.branches.length === 0) {
        list.appendChild(el("li", { text: "(none)" }));
      } else {
        t.branches.forEach((name) => {
          const finishBtn = el("button", { text: "Finish" });
          finishBtn.addEventListener("click", () =>
            vscode.postMessage({ type: "finish", branch: name }),
          );

          const publishBtn = el("button", { text: "Publish", class: "secondary" });
          publishBtn.addEventListener("click", () =>
            vscode.postMessage({ type: "publish", branch: name }),
          );

          const updateBtn = el("button", { text: "Update", class: "secondary" });
          updateBtn.addEventListener("click", () =>
            vscode.postMessage({ type: "update", branch: name }),
          );

          const rebaseBtn = el("button", { text: "Rebase", class: "secondary" });
          rebaseBtn.addEventListener("click", () =>
            vscode.postMessage({ type: "rebase", branch: name }),
          );

          const actions = el(
            "span",
            { style: "display:flex;gap:4px;flex-wrap:wrap;" },
            [finishBtn, publishBtn, updateBtn, rebaseBtn],
          );
          list.appendChild(
            el("li", { class: "branch-row" }, [el("span", { text: name }), actions]),
          );
        });
      }
      section.appendChild(list);
      types.appendChild(section);
    });
  }

  document.getElementById("start").addEventListener("click", () => vscode.postMessage({ type: "start" }));
  document.getElementById("pull").addEventListener("click", () => vscode.postMessage({ type: "pull" }));
  document.getElementById("push").addEventListener("click", () => vscode.postMessage({ type: "push" }));
  document.getElementById("doctor").addEventListener("click", () => vscode.postMessage({ type: "runDoctor" }));
  document.getElementById("refresh").addEventListener("click", () => vscode.postMessage({ type: "refresh" }));
  document.getElementById("track").addEventListener("click", () =>
    vscode.postMessage({ type: "track" }),
  );
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "data") render(message.payload);
  });

  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }
}
