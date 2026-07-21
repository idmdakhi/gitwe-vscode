import * as vscode from "vscode";
import type { BranchTreeNode, DoctorReport } from "gitwe";
import { getContainer, getSettings, pickWorkspaceFolder } from "../gitweClient";
import { showGitweError } from "../util/errors";

interface DashboardData {
  workflowName: string;
  currentBranch: string;
  workingTreeClean: boolean;
  branchTypes: { name: string; prefix: string; baseBranch: string; mergeTargets: string[]; autoTag: boolean }[];
  tree: BranchTreeNode;
  doctor: DoctorReport | undefined;
  error: string | undefined;
}

type InboundMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "runDoctor" }
  | { type: "start" }
  | { type: "finish"; branch: string }
  | { type: "pull" }
  | { type: "push" };

/**
 * Singleton webview panel — a visual dashboard on top of the same handlers
 * the tree view and commands use. It doesn't duplicate any gitwe logic:
 * mutating actions (start/finish/pull/push) are delegated straight back to
 * the registered VS Code commands, and this panel just re-fetches +
 * re-renders afterwards.
 */
export class GitwePanel {
  private static current: GitwePanel | undefined;

  static show(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
    if (GitwePanel.current) {
      GitwePanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel("gitweDashboard", "Gitwe Dashboard", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    GitwePanel.current = new GitwePanel(panel, context, outputChannel);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
  ) {
    this.panel.webview.html = this.renderShell();
    this.panel.onDidDispose(() => (GitwePanel.current = undefined), null, context.subscriptions);
    this.panel.webview.onDidReceiveMessage((message: InboundMessage) => this.handleMessage(message));
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
      branchTypes: [],
      tree: { name: "main", isCurrent: false, children: [] },
      doctor: undefined,
      error: undefined,
    };
    if (!folder) return { ...empty, error: "Open a folder with a git repository." };

    const container = getContainer(folder, this.outputChannel);
    try {
      const [currentBranch, workingTreeClean, statusReport] = await Promise.all([
        container.git.getCurrentBranch(),
        container.git.isWorkingTreeClean(),
        container.getStatusHandler.handle({ rootBranch: getSettings().defaultRootBranch }),
      ]);

      return {
        workflowName: container.workflow.name,
        currentBranch,
        workingTreeClean,
        branchTypes: container.workflow.branchTypes.map((rule) => ({
          name: rule.name,
          prefix: rule.prefix,
          baseBranch: rule.baseBranch,
          mergeTargets: [...rule.mergeTargets],
          autoTag: Boolean(rule.autoTag),
        })),
        tree: statusReport.tree,
        doctor: undefined,
        error: undefined,
      };
    } catch (error) {
      await showGitweError(error, this.outputChannel);
      return { ...empty, error: error instanceof Error ? error.message : String(error) };
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
  section { margin: 18px 0; }
  h2 { font-size: 0.95em; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.75; margin-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--vscode-widget-border, #444); font-size: 0.9em; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 2px; cursor: pointer; margin-right: 8px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  ul.tree, ul.tree ul { list-style: none; margin: 0; padding-left: 18px; }
  ul.tree { padding-left: 0; }
  ul.tree li { padding: 2px 0; }
  .current { font-weight: 600; color: var(--vscode-textLink-foreground); }
  .branch-row { display: flex; align-items: center; justify-content: space-between; }
  .branch-row button { padding: 2px 8px; font-size: 0.8em; margin: 0; }
  .error { color: var(--vscode-errorForeground); }
  .toolbar { display: flex; gap: 8px; margin-bottom: 14px; }
</style>
</head>
<body>
  <h1>🌿 Gitwe Dashboard <span id="workflow-pill" class="pill"></span></h1>
  <div id="error" class="error" style="display:none"></div>

  <div class="toolbar">
    <button id="start">Start Branch</button>
    <button id="pull" class="secondary">Pull</button>
    <button id="push" class="secondary">Push</button>
    <button id="doctor" class="secondary">Run Doctor</button>
    <button id="refresh" class="secondary">Refresh</button>
  </div>

  <section>
    <h2>Status</h2>
    <div id="status"></div>
  </section>

  <section>
    <h2>Branch Types</h2>
    <table id="types-table">
      <thead><tr><th>Type</th><th>Prefix</th><th>Base</th><th>Merges into</th><th></th></tr></thead>
      <tbody id="types-body"></tbody>
    </table>
  </section>

  <section>
    <h2>Branch Graph</h2>
    <ul class="tree" id="tree"></ul>
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

  function renderTreeNode(node) {
    const li = el("li");
    const label = el("span", { class: node.isCurrent ? "current" : "", text: node.name + (node.isCurrent ? " (current)" : "") });
    li.appendChild(label);
    if (node.children && node.children.length > 0) {
      const ul = el("ul");
      node.children.forEach((child) => ul.appendChild(renderTreeNode(child)));
      li.appendChild(ul);
    }
    return li;
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

    const typesBody = document.getElementById("types-body");
    typesBody.innerHTML = "";
    (data.branchTypes || []).forEach((t) => {
      const tr = el("tr", {}, [
        el("td", { text: t.name }),
        el("td", { text: t.prefix }),
        el("td", { text: t.baseBranch }),
        el("td", { text: t.mergeTargets.join(", ") + (t.autoTag ? " 🏷️" : "") }),
      ]);
      typesBody.appendChild(tr);
    });

    const tree = document.getElementById("tree");
    tree.innerHTML = "";
    if (data.tree) tree.appendChild(renderTreeNode(data.tree));
  }

  document.getElementById("start").addEventListener("click", () => vscode.postMessage({ type: "start" }));
  document.getElementById("pull").addEventListener("click", () => vscode.postMessage({ type: "pull" }));
  document.getElementById("push").addEventListener("click", () => vscode.postMessage({ type: "push" }));
  document.getElementById("doctor").addEventListener("click", () => vscode.postMessage({ type: "runDoctor" }));
  document.getElementById("refresh").addEventListener("click", () => vscode.postMessage({ type: "refresh" }));

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
