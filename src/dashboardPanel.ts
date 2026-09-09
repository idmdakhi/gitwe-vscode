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
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<style>
  /* ============================================================
     gitwe Dashboard — redesigned with ui-ux-pro-max
     Style: Dark Mode (OLED) + Developer Tool palette
     Typography: IBM Plex Sans + JetBrains Mono
     Density: Dashboard (8/10)  |  Motion: Standard (4/10)
     ============================================================ */
  :root {
    --gw-bg:            var(--vscode-editor-background, #0f172a);
    --gw-fg:            var(--vscode-editor-foreground, #f8fafc);
    --gw-card:          var(--vscode-sideBar-background, #1b2336);
    --gw-card-elevated: color-mix(in srgb, var(--gw-card) 92%, #ffffff 8%);
    --gw-muted:         var(--vscode-input-background, #272f42);
    --gw-muted-fg:      var(--vscode-descriptionForeground, #94a3b8);
    --gw-border:        var(--vscode-widget-border, #475569);
    --gw-border-subtle: color-mix(in srgb, var(--gw-border) 55%, transparent);
    --gw-accent:        #22c55e;
    --gw-accent-soft:   color-mix(in srgb, #22c55e 18%, transparent);
    --gw-accent-fg:     #0f172a;
    --gw-destructive:   #ef4444;
    --gw-destructive-soft: color-mix(in srgb, #ef4444 16%, transparent);
    --gw-warning:       #f2b90c;
    --gw-warning-soft:  color-mix(in srgb, #f2b90c 16%, transparent);
    --gw-info:          #38bdf8;
    --gw-radius:        10px;
    --gw-radius-sm:     6px;
    --gw-radius-full:   9999px;
    --gw-font-ui:       var(--vscode-font-family), "IBM Plex Sans", system-ui, sans-serif;
    --gw-font-mono:     var(--vscode-editor-font-family), "JetBrains Mono", ui-monospace, monospace;
    --gw-shadow:        0 1px 2px color-mix(in srgb, #000 25%, transparent),
                        0 4px 12px color-mix(in srgb, #000 12%, transparent);
    --gw-shadow-hover:  0 2px 4px color-mix(in srgb, #000 20%, transparent),
                        0 8px 24px color-mix(in srgb, #000 18%, transparent);
    --gw-transition:    160ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--gw-font-ui);
    color: var(--gw-fg);
    background: var(--gw-bg);
    padding: 20px 24px 32px;
    font-size: 13px;
    line-height: 1.5;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* ---- Typography ---- */
  h1 {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h1 .logo {
    width: 22px; height: 22px;
    border-radius: 6px;
    background: var(--gw-accent);
    display: grid; place-items: center;
    color: var(--gw-accent-fg);
    flex-shrink: 0;
  }
  h1 .logo svg { width: 14px; height: 14px; }
  h2 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gw-muted-fg);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--gw-border-subtle);
  }

  .branch-name { font-family: var(--gw-font-mono); font-weight: 500; }

  /* ---- Header ---- */
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }
  .header-text .subtitle {
    color: var(--gw-muted-fg);
    font-size: 12px;
    margin-top: 4px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  /* ---- Buttons ---- */
  button {
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--gw-radius-sm);
    border: 1px solid var(--gw-border);
    background: var(--vscode-button-secondaryBackground, var(--gw-muted));
    color: var(--vscode-button-secondaryForeground, var(--gw-fg));
    padding: 7px 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    transition: background var(--gw-transition),
                border-color var(--gw-transition),
                box-shadow var(--gw-transition),
                transform var(--gw-transition);
    white-space: nowrap;
  }
  button svg { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.9; }
  button:hover {
    border-color: var(--gw-accent);
    background: color-mix(in srgb, var(--gw-accent) 10%, var(--gw-muted));
  }
  button:active { transform: scale(0.97); }
  button:focus-visible {
    outline: 2px solid var(--gw-accent);
    outline-offset: 2px;
  }
  button.primary {
    background: var(--gw-accent);
    color: var(--gw-accent-fg);
    border-color: var(--gw-accent);
    font-weight: 600;
    box-shadow: 0 0 0 0 transparent;
  }
  button.primary:hover {
    filter: brightness(1.1);
    box-shadow: 0 0 16px color-mix(in srgb, var(--gw-accent) 35%, transparent);
  }
  button.ghost {
    background: transparent;
    border-color: transparent;
  }
  button.ghost:hover {
    background: color-mix(in srgb, var(--gw-fg) 8%, transparent);
    border-color: transparent;
  }
  button.small {
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 5px;
  }
  button.icon-only {
    padding: 6px;
    width: 30px; height: 30px;
    justify-content: center;
  }

  /* ---- Stat cards ---- */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 28px;
  }
  .card {
    background: var(--gw-card);
    border: 1px solid var(--gw-border-subtle);
    border-radius: var(--gw-radius);
    padding: 16px 18px;
    box-shadow: var(--gw-shadow);
    transition: border-color var(--gw-transition), box-shadow var(--gw-transition);
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 2px;
    background: linear-gradient(90deg, var(--gw-accent), transparent 70%);
    opacity: 0.7;
  }
  .card:hover {
    border-color: var(--gw-border);
    box-shadow: var(--gw-shadow-hover);
  }
  .card .value {
    font-size: 22px;
    font-weight: 700;
    font-family: var(--gw-font-mono);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .card .label {
    color: var(--gw-muted-fg);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 6px;
    font-weight: 500;
  }
  .card .icon {
    position: absolute;
    top: 14px; right: 14px;
    width: 28px; height: 28px;
    border-radius: 8px;
    background: var(--gw-accent-soft);
    display: grid; place-items: center;
    color: var(--gw-accent);
  }
  .card .icon svg { width: 15px; height: 15px; }

  /* ---- Sections ---- */
  section { margin-bottom: 28px; }

  /* ---- Doctor findings ---- */
  .findings-card {
    background: var(--gw-card);
    border: 1px solid var(--gw-border-subtle);
    border-radius: var(--gw-radius);
    padding: 4px 0;
    box-shadow: var(--gw-shadow);
  }
  .finding {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--gw-border-subtle);
    font-size: 12.5px;
    transition: background var(--gw-transition);
  }
  .finding:last-child { border-bottom: none; }
  .finding:hover { background: color-mix(in srgb, var(--gw-fg) 4%, transparent); }
  .finding .dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
    box-shadow: 0 0 0 3px transparent;
  }
  .dot.ok {
    background: var(--gw-accent);
    box-shadow: 0 0 0 3px var(--gw-accent-soft);
  }
  .dot.warning {
    background: var(--gw-warning);
    box-shadow: 0 0 0 3px var(--gw-warning-soft);
  }
  .dot.error {
    background: var(--gw-destructive);
    box-shadow: 0 0 0 3px var(--gw-destructive-soft);
  }
  .finding .fix-badge {
    margin-inline-start: auto;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--gw-info);
    background: color-mix(in srgb, var(--gw-info) 14%, transparent);
    border-radius: var(--gw-radius-full);
    padding: 2px 8px;
    flex-shrink: 0;
  }

  /* ---- Branch list ---- */
  .branches-card {
    background: var(--gw-card);
    border: 1px solid var(--gw-border-subtle);
    border-radius: var(--gw-radius);
    overflow: hidden;
    box-shadow: var(--gw-shadow);
  }
  ul.branch-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ul.branch-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--gw-border-subtle);
    transition: background var(--gw-transition);
  }
  ul.branch-list li:last-child { border-bottom: none; }
  ul.branch-list li:hover {
    background: color-mix(in srgb, var(--gw-fg) 5%, transparent);
  }
  ul.branch-list .type-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--gw-accent);
    background: var(--gw-accent-soft);
    border-radius: 4px;
    padding: 2px 7px;
    flex-shrink: 0;
    min-width: 64px;
    text-align: center;
  }
  ul.branch-list .type-badge.feature { color: #38bdf8; background: color-mix(in srgb, #38bdf8 16%, transparent); }
  ul.branch-list .type-badge.bugfix,
  ul.branch-list .type-badge.hotfix { color: #f97316; background: color-mix(in srgb, #f97316 16%, transparent); }
  ul.branch-list .type-badge.release { color: #a78bfa; background: color-mix(in srgb, #a78bfa 16%, transparent); }
  ul.branch-list .type-badge.chore { color: var(--gw-muted-fg); background: color-mix(in srgb, var(--gw-muted-fg) 14%, transparent); }
  ul.branch-list .spacer { flex: 1; }
  ul.branch-list .branch-actions {
    display: flex;
    gap: 6px;
    opacity: 0.55;
    transition: opacity var(--gw-transition);
  }
  ul.branch-list li:hover .branch-actions { opacity: 1; }

  /* ---- Empty & banners ---- */
  .empty {
    color: var(--gw-muted-fg);
    padding: 36px 20px;
    text-align: center;
    font-size: 13px;
  }
  .empty svg {
    width: 40px; height: 40px;
    margin: 0 auto 12px;
    opacity: 0.35;
    display: block;
  }
  .banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: var(--gw-radius);
    background: var(--gw-card);
    border: 1px solid var(--gw-border);
    margin-bottom: 20px;
    font-size: 13px;
  }
  .banner.error {
    border-color: color-mix(in srgb, var(--gw-destructive) 45%, transparent);
    background: var(--gw-destructive-soft);
    color: var(--gw-destructive);
  }
  .banner.info {
    border-color: color-mix(in srgb, var(--gw-info) 40%, transparent);
    background: color-mix(in srgb, var(--gw-info) 10%, transparent);
  }
  .hidden { display: none !important; }

  /* ---- Stagger animation ---- */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .anim {
    animation: fadeUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .anim:nth-child(1) { animation-delay: 0.02s; }
  .anim:nth-child(2) { animation-delay: 0.06s; }
  .anim:nth-child(3) { animation-delay: 0.10s; }
  .anim:nth-child(4) { animation-delay: 0.14s; }
  .anim:nth-child(5) { animation-delay: 0.18s; }
  .anim:nth-child(6) { animation-delay: 0.22s; }

  /* ---- Responsive ---- */
  @media (max-width: 520px) {
    body { padding: 14px 12px 24px; }
    .grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    header { flex-direction: column; }
    .actions { width: 100%; }
  }
</style>
</head>
<body>
  <div id="banner" class="banner hidden" role="alert"></div>

  <header>
    <div class="header-text">
      <h1>
        <span class="logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
        </span>
        gitwe
      </h1>
      <p class="subtitle">Workflow overview · topic branches · health</p>
    </div>
    <div class="actions">
      <button class="primary" data-cmd="gitwe.start" title="Start a new topic branch">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Start branch
      </button>
      <button data-cmd="gitwe.finishCurrent" title="Finish the current branch">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        Finish
      </button>
      <button class="ghost icon-only" data-cmd="refresh" title="Refresh dashboard" aria-label="Refresh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
      </button>
    </div>
  </header>

  <section>
    <h2>Overview</h2>
    <div class="grid" id="overview">
      <div class="card anim">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg></div>
        <div class="value" id="stat-current">—</div>
        <div class="label">Current branch</div>
      </div>
      <div class="card anim">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
        <div class="value" id="stat-topics">—</div>
        <div class="label">Topic branches</div>
      </div>
      <div class="card anim">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div class="value" id="stat-health">—</div>
        <div class="label">Health</div>
      </div>
    </div>
  </section>

  <section>
    <h2>Doctor</h2>
    <div class="findings-card" id="doctor">
      <div class="empty">Loading…</div>
    </div>
  </section>

  <section>
    <h2>Topic branches</h2>
    <div class="branches-card">
      <ul class="branch-list" id="branch-list">
        <li class="empty">Loading…</li>
      </ul>
    </div>
  </section>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (sel) => document.querySelector(sel);

  // Action buttons
  document.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      if (cmd === 'refresh') {
        vscode.postMessage({ type: 'refresh' });
      } else {
        vscode.postMessage({ type: 'runCommand', command: cmd });
      }
    });
  });

  function showBanner(text, isError) {
    const el = $('#banner');
    el.textContent = text;
    el.className = 'banner ' + (isError ? 'error' : 'info');
  }
  function hideBanner() {
    $('#banner').className = 'banner hidden';
  }

  function renderOverview(overview) {
    const current = overview?.current || overview?.currentBranch || '—';
    const topics  = overview?.topicCount ?? overview?.topics ?? overview?.branchCount ?? '—';
    const health  = overview?.health || overview?.status || 'ok';

    const curEl = $('#stat-current');
    curEl.textContent = typeof current === 'string' ? current.replace(/^.*\\//, '') : '—';
    curEl.className = 'value branch-name';

    $('#stat-topics').textContent = topics;

    const healthEl = $('#stat-health');
    healthEl.textContent = health;
    if (String(health).toLowerCase() === 'ok' || String(health).toLowerCase() === 'healthy') {
      healthEl.style.color = 'var(--gw-accent)';
    } else if (String(health).toLowerCase().includes('warn')) {
      healthEl.style.color = 'var(--gw-warning)';
    } else {
      healthEl.style.color = 'var(--gw-destructive)';
    }
  }

  function renderDoctor(doctor) {
    const card = $('#doctor');
    card.innerHTML = '';
    const findings = doctor?.findings || [];
    if (!findings.length) {
      card.innerHTML = \`
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          All clear — no findings.
        </div>\`;
      return;
    }
    for (const f of findings) {
      const row = document.createElement('div');
      row.className = 'finding anim';
      const sev = (f.severity || 'ok').toLowerCase();
      row.innerHTML =
        '<span class="dot ' + sev + '" aria-hidden="true"></span>' +
        '<span>' + escapeHtml(f.message) + '</span>' +
        (f.fixable ? '<span class="fix-badge">fixable</span>' : '');
      card.appendChild(row);
    }
  }

  function typeClass(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('feature')) return 'feature';
    if (t.includes('bug') || t.includes('fix') || t.includes('hot')) return 'hotfix';
    if (t.includes('release')) return 'release';
    if (t.includes('chore')) return 'chore';
    return '';
  }

  function renderBranches(list) {
    const ul = $('#branch-list');
    ul.innerHTML = '';
    const branches = list?.branches || [];
    if (!branches.length) {
      ul.innerHTML = \`
        <li class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
          No topic branches yet. Click <strong>Start branch</strong> above.
        </li>\`;
      return;
    }
    for (const b of branches) {
      const li = document.createElement('li');
      li.className = 'anim';

      const badge = document.createElement('span');
      badge.className = 'type-badge ' + typeClass(b.type);
      badge.textContent = b.type || 'topic';

      const name = document.createElement('span');
      name.className = 'branch-name';
      name.textContent = b.shortName || b.branch || b.name;

      const spacer = document.createElement('span');
      spacer.className = 'spacer';

      const actions = document.createElement('div');
      actions.className = 'branch-actions';

      const checkoutBtn = document.createElement('button');
      checkoutBtn.className = 'small';
      checkoutBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Checkout';
      checkoutBtn.addEventListener('click', () => vscode.postMessage({ type: 'checkout', branch: b.branch }));

      const finishBtn = document.createElement('button');
      finishBtn.className = 'small';
      finishBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Finish';
      finishBtn.addEventListener('click', () => vscode.postMessage({ type: 'finish', branch: b.branch }));

      actions.append(checkoutBtn, finishBtn);
      li.append(badge, name, spacer, actions);
      ul.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
