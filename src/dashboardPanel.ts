import * as vscode from "vscode";
import { GitweRepo, GitweCliError, GitweNotFoundError, GitweDoctorFinding } from "./cli";

type InboundMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "runCommand"; command: string }
  | { type: "checkout"; branch: string }
  | { type: "finish"; branch: string };

export class GitweDashboardPanel {
  private static current: GitweDashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext, getRepo: () => GitweRepo | undefined): void {
    if (GitweDashboardPanel.current) {
      GitweDashboardPanel.current.panel.reveal();
      void GitweDashboardPanel.current.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel("gitwe.dashboard", "gitwe: Dashboard", vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [],
    });

    GitweDashboardPanel.current = new GitweDashboardPanel(panel, context, getRepo);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    private readonly getRepo: () => GitweRepo | undefined,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.renderHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message: InboundMessage) => void this.handleMessage(message),
      null,
      this.disposables,
    );

    context.subscriptions.push(
      vscode.window.onDidChangeActiveColorTheme(() => void this.refresh(), null, this.disposables),
    );
  }

  private async handleMessage(message: InboundMessage): Promise<void> {
    switch (message.type) {
      case "ready":
      case "refresh":
        await this.refresh();
        return;
      case "runCommand":
        await vscode.commands.executeCommand(message.command);
        await this.refresh();
        return;
      case "checkout":
        await vscode.commands.executeCommand("gitwe.checkoutBranchByName", message.branch);
        await this.refresh();
        return;
      case "finish":
        await vscode.commands.executeCommand("gitwe.finishBranchByName", message.branch);
        await this.refresh();
        return;
    }
  }

  async refresh(): Promise<void> {
    const repo = this.getRepo();
    if (!repo) {
      void this.panel.webview.postMessage({ type: "noWorkspace" });
      return;
    }

    try {
      const [overview, doctor, list] = await Promise.all([repo.overview(), repo.doctor(false), repo.list()]);
      void this.panel.webview.postMessage({ type: "data", overview, doctor, list });
    } catch (err) {
      if (err instanceof GitweNotFoundError) {
        void this.panel.webview.postMessage({ type: "notInstalled", message: err.message });
        return;
      }
      const message = err instanceof GitweCliError ? err.message : String(err);
      void this.panel.webview.postMessage({ type: "error", message });
    }
  }

  dispose(): void {
    GitweDashboardPanel.current = undefined;
    for (const d of this.disposables.splice(0)) d.dispose();
    this.panel.dispose();
  }

  private renderHtml(): string {
    const nonce = String(Math.random()).slice(2);
    const csp = [
      "default-src 'none'",
      `style-src 'unsafe-inline'`,
      `font-src https://fonts.gstatic.com`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>gitwe dashboard</title>
<style>
  /* ---- Design tokens (ui-ux-pro-max: "Dark Mode (OLED)" + developer-tool
     typography), layered on top of VS Code's own theme variables so the
     panel still blends into light themes instead of forcing dark mode. ---- */
  :root {
    --gw-bg: var(--vscode-editor-background);
    --gw-fg: var(--vscode-editor-foreground);
    --gw-card: var(--vscode-sideBar-background, #1b2336);
    --gw-muted-fg: var(--vscode-descriptionForeground, #94a3b8);
    --gw-border: var(--vscode-widget-border, #475569);
    --gw-accent: #22c55e;
    --gw-accent-fg: #0f172a;
    --gw-destructive: #ef4444;
    --gw-warning: #f2b90c;
    --gw-radius: 8px;
    --gw-font-ui: var(--vscode-font-family), "IBM Plex Sans", sans-serif;
    --gw-font-mono: var(--vscode-editor-font-family), "JetBrains Mono", monospace;
  }

  * { box-sizing: border-box; }

  body {
    font-family: var(--gw-font-ui);
    color: var(--gw-fg);
    background: var(--gw-bg);
    margin: 0;
    padding: 24px;
    font-size: 13px;
    line-height: 1.5;
  }

  h1 { font-size: 15px; margin: 0 0 2px; font-weight: 600; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gw-muted-fg); margin: 0 0 10px; font-weight: 600; }

  .branch-name { font-family: var(--gw-font-mono); }

  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
  .subtitle { color: var(--gw-muted-fg); font-size: 12px; margin-top: 2px; }

  .actions { display: flex; gap: 8px; flex-wrap: wrap; }

  button {
    font-family: inherit;
    font-size: 12px;
    border-radius: var(--gw-radius);
    border: 1px solid var(--gw-border);
    background: var(--vscode-button-secondaryBackground, transparent);
    color: var(--vscode-button-secondaryForeground, var(--gw-fg));
    padding: 6px 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background-color 150ms ease, border-color 150ms ease;
  }
  button:hover { border-color: var(--gw-accent); }
  button:focus-visible { outline: 2px solid var(--gw-accent); outline-offset: 2px; }
  button.primary {
    background: var(--gw-accent);
    color: var(--gw-accent-fg);
    border-color: var(--gw-accent);
    font-weight: 600;
  }
  button.primary:hover { filter: brightness(1.08); }
  button.small { padding: 3px 8px; font-size: 11px; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 24px; }

  .card {
    background: var(--gw-card);
    border: 1px solid var(--gw-border);
    border-radius: var(--gw-radius);
    padding: 14px 16px;
  }
  .card .value { font-size: 20px; font-weight: 700; font-family: var(--gw-font-mono); }
  .card .label { color: var(--gw-muted-fg); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }

  section { margin-bottom: 24px; }

  .finding { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--gw-border); font-size: 12px; }
  .finding:last-child { border-bottom: none; }
  .finding .dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
  .dot.ok { background: var(--gw-accent); }
  .dot.warning { background: var(--gw-warning); }
  .dot.error { background: var(--gw-destructive); }
  .finding .fix-badge { color: var(--gw-muted-fg); font-size: 10px; border: 1px solid var(--gw-border); border-radius: 999px; padding: 0 6px; margin-inline-start: auto; }

  ul.branch-list { list-style: none; margin: 0; padding: 0; }
  ul.branch-list li {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 4px; border-radius: 6px;
  }
  ul.branch-list li:hover { background: color-mix(in srgb, var(--gw-fg) 6%, transparent); }
  ul.branch-list .type-badge {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--gw-muted-fg); border: 1px solid var(--gw-border); border-radius: 4px; padding: 1px 5px;
  }
  ul.branch-list .spacer { flex: 1; }

  .empty, .banner { color: var(--gw-muted-fg); padding: 24px 0; text-align: center; }
  .banner.error { color: var(--gw-destructive); }
  .hidden { display: none; }
</style>
</head>
<body>
  <header>
    <div>
      <h1 id="workflow-name">gitwe</h1>
      <div class="subtitle" id="current-branch">loading…</div>
    </div>
    <div class="actions">
      <button class="primary" data-cmd="gitwe.start">Start branch</button>
      <button data-cmd="gitwe.finishCurrent">Finish current</button>
      <button data-cmd="gitwe.sync">Sync</button>
      <button data-cmd="gitwe.doctorFix">Doctor --fix</button>
      <button id="refresh-btn" title="Refresh">↻</button>
    </div>
  </header>

  <section>
    <h2>Overview</h2>
    <div class="grid" id="overview-grid"></div>
  </section>

  <section>
    <h2>Health (gitwe doctor)</h2>
    <div class="card" id="doctor-card"><div class="empty">loading…</div></div>
  </section>

  <section>
    <h2>Topic branches</h2>
    <div class="card">
      <ul class="branch-list" id="branch-list"><li class="empty">loading…</li></ul>
    </div>
  </section>

  <div id="banner" class="banner hidden"></div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (sel) => document.querySelector(sel);

  document.querySelectorAll('button[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => vscode.postMessage({ type: 'runCommand', command: btn.dataset.cmd }));
  });
  $('#refresh-btn').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));

  function showBanner(text, isError) {
    const el = $('#banner');
    el.textContent = text;
    el.classList.toggle('error', !!isError);
    el.classList.remove('hidden');
  }
  function hideBanner() { $('#banner').classList.add('hidden'); }

  function renderOverview(overview) {
    $('#workflow-name').textContent = 'gitwe — ' + overview.workflowName;
    $('#current-branch').textContent = overview.currentBranch
      ? 'On ' + overview.currentBranch
      : 'Detached HEAD';

    const grid = $('#overview-grid');
    grid.innerHTML = '';
    const baseCard = document.createElement('div');
    baseCard.className = 'card';
    baseCard.innerHTML = '<div class="value">' + overview.baseBranches.length + '</div><div class="label">Base branches</div>';
    grid.appendChild(baseCard);

    for (const t of overview.branchTypes) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="value">' + t.count + '</div>' +
        '<div class="label branch-name">' + t.type + ' \u2192 ' + t.target.join(', ') + '</div>';
      grid.appendChild(card);
    }
  }

  function renderDoctor(doctor) {
    const card = $('#doctor-card');
    card.innerHTML = '';
    if (!doctor.findings.length) {
      card.innerHTML = '<div class="empty">No findings.</div>';
      return;
    }
    for (const f of doctor.findings) {
      const row = document.createElement('div');
      row.className = 'finding';
      row.innerHTML =
        '<span class="dot ' + f.severity + '"></span>' +
        '<span>' + f.message + '</span>' +
        (f.fixable ? '<span class="fix-badge">fixable</span>' : '');
      card.appendChild(row);
    }
  }

  function renderBranches(list) {
    const ul = $('#branch-list');
    ul.innerHTML = '';
    if (!list.branches.length) {
      ul.innerHTML = '<li class="empty">No topic branches yet. Click "Start branch" above.</li>';
      return;
    }
    for (const b of list.branches) {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'branch-name';
      nameSpan.textContent = b.shortName;
      const typeBadge = document.createElement('span');
      typeBadge.className = 'type-badge';
      typeBadge.textContent = b.type;
      const spacer = document.createElement('span');
      spacer.className = 'spacer';
      const checkoutBtn = document.createElement('button');
      checkoutBtn.className = 'small';
      checkoutBtn.textContent = 'Checkout';
      checkoutBtn.addEventListener('click', () => vscode.postMessage({ type: 'checkout', branch: b.branch }));
      const finishBtn = document.createElement('button');
      finishBtn.className = 'small';
      finishBtn.textContent = 'Finish\u2026';
      finishBtn.addEventListener('click', () => vscode.postMessage({ type: 'finish', branch: b.branch }));

      li.append(typeBadge, nameSpan, spacer, checkoutBtn, finishBtn);
      ul.appendChild(li);
    }
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'data':
        hideBanner();
        renderOverview(msg.overview);
        renderDoctor(msg.doctor);
        renderBranches(msg.list);
        break;
      case 'notInstalled':
        showBanner('gitwe is not installed: ' + msg.message, true);
        break;
      case 'noWorkspace':
        showBanner('Open a folder with a gitwe workflow to see its dashboard.', false);
        break;
      case 'error':
        showBanner(msg.message, true);
        break;
    }
  });

  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

/** Re-exported so extension.ts can type-annotate findings without importing cli.ts twice. */
export type { GitweDoctorFinding };
