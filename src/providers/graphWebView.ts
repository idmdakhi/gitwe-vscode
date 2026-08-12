import * as vscode from "vscode";
import * as path from "node:path";
import { GitweClient } from "../gitwe/client";

export class GraphWebView {
  public static currentPanel: GraphWebView | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private rootBranch: string = "main";

  constructor(
    private client: GitweClient,
    private context: vscode.ExtensionContext,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      "gitweGraph",
      "Gitwe Graph",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "src/webview"),
        ],
      },
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "checkout":
            await this.client.checkout(message.branch);
            await this.updateContent();
            vscode.window.showInformationMessage(
              `Switched to ${message.branch}`,
            );
            break;
          case "finish":
            try {
              const result = await this.client.finishBranch(
                message.branch,
                true,
                false,
              );
              await this.updateContent();
              vscode.window.showInformationMessage(
                `Finished ${message.branch} → ${result.merges.map((m) => m.target).join(", ")}`,
              );
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to finish: ${error.message}`,
              );
            }
            break;
          case "refresh":
            await this.updateContent();
            break;
        }
      },
      null,
      this.disposables,
    );

    this.updateContent();
  }

  private async updateContent() {
    try {
      const report = await this.client.getStatus(this.rootBranch);
      const graphData = this.buildGraphData(report.tree);
      this.panel.webview.html = this.getHtml(graphData);
    } catch (error) {
      this.panel.webview.html = this.getErrorHtml(error.message);
    }
  }

  private buildGraphData(node: any): any {
    if (!node) return { name: "root", children: [] };
    return {
      name: node.name,
      isCurrent: node.isCurrent || false,
      children: node.children.map((child: any) => this.buildGraphData(child)),
    };
  }

  private getHtml(data: any): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      height: 100vh;
    }
    #container {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #toolbar {
      display: flex;
      gap: 10px;
      padding: 10px 16px;
      background: #252526;
      border-bottom: 1px solid #3c3c3c;
      align-items: center;
      flex-shrink: 0;
    }
    #toolbar button {
      background: #0e639c;
      color: white;
      border: none;
      padding: 4px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    #toolbar button:hover { background: #1177bb; }
    #toolbar span { font-size: 12px; color: #888; }
    #graph { flex: 1; }
    .node-circle { cursor: pointer; }
    .node-circle.current { fill: #f0c674; stroke: #f0c674; }
    .node-circle.finishable { fill: #4a9eff; stroke: #4a9eff; }
    .node-circle:hover { stroke-width: 3px; }
    .node-text { font-size: 11px; fill: #ccc; }
    .link { stroke: #555; stroke-width: 2px; }
    .tooltip {
      position: absolute;
      background: #2d2d2d;
      border: 1px solid #555;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="toolbar">
      <button onclick="refreshGraph()">🔄 Refresh</button>
      <button onclick="zoomIn()">➕</button>
      <button onclick="zoomOut()">➖</button>
      <button onclick="resetView()">⟲ Reset</button>
      <span>Click a node to finish or checkout</span>
    </div>
    <div id="graph"></div>
  </div>
  <div id="tooltip" class="tooltip"></div>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script>
    const vscode = acquireVsCodeApi();
    let currentZoom = 1;

    const data = ${JSON.stringify(data)};
    const rootName = data.name || 'root';

    function refreshGraph() {
      vscode.postMessage({ command: 'refresh' });
    }

    function zoomIn() {
      currentZoom *= 1.2;
      applyZoom();
    }

    function zoomOut() {
      currentZoom /= 1.2;
      applyZoom();
    }

    function resetView() {
      currentZoom = 1;
      applyZoom();
    }

    function applyZoom() {
      d3.select('#graph svg g').attr('transform', 'scale(' + currentZoom + ')');
    }

    function renderTree(data) {
      const container = document.getElementById('graph');
      container.innerHTML = '';

      const width = container.clientWidth;
      const height = container.clientHeight;

      const svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      const g = svg.append('g');

      // تبدیل به ساختار درختی
      const root = d3.hierarchy(data);
      const treeLayout = d3.tree()
        .size([Math.max(width - 120, 400), Math.max(height - 120, 400)])
        .separation((a, b) => (a.depth + b.depth) * 0.2 + 0.5);

      const treeData = treeLayout(root);

      // رسم لینک‌ها
      g.selectAll('.link')
        .data(treeData.links())
        .enter().append('line')
        .attr('class', 'link')
        .attr('x1', d => d.source.x + 60)
        .attr('y1', d => d.source.y + 50)
        .attr('x2', d => d.target.x + 60)
        .attr('y2', d => d.target.y + 50);

      // رسم گره‌ها
      const nodes = g.selectAll('.node')
        .data(treeData.descendants())
        .enter().append('g')
        .attr('transform', d => 'translate(' + (d.x + 60) + ',' + (d.y + 50) + ')');

      nodes.append('circle')
        .attr('r', 12)
        .attr('class', d => {
          let cls = 'node-circle';
          if (d.data.isCurrent) cls += ' current';
          else cls += ' finishable';
          return cls;
        })
        .on('click', (event, d) => {
          const name = d.data.name;
          if (d.data.isCurrent) {
            if (confirm('Finish branch "' + name + '"?')) {
              vscode.postMessage({ command: 'finish', branch: name });
            }
          } else {
            vscode.postMessage({ command: 'checkout', branch: name });
          }
        })
        .on('mouseenter', (event, d) => {
          const tooltip = document.getElementById('tooltip');
          tooltip.style.opacity = 1;
          tooltip.textContent = d.data.name + (d.data.isCurrent ? ' (current)' : '');
          tooltip.style.left = (event.clientX + 10) + 'px';
          tooltip.style.top = (event.clientY - 30) + 'px';
        })
        .on('mouseleave', () => {
          document.getElementById('tooltip').style.opacity = 0;
        });

      nodes.append('text')
        .attr('class', 'node-text')
        .attr('dy', '.35em')
        .attr('x', 18)
        .text(d => d.data.name.length > 20 ? d.data.name.slice(0, 18) + '…' : d.data.name);

      // مرکز کردن
      const firstNode = treeData.descendants()[0];
      if (firstNode) {
        const tx = width / 2 - firstNode.x - 60;
        const ty = 50;
        g.attr('transform', 'translate(' + tx + ',' + ty + ')');
      }
    }

    renderTree(data);

    // بازسازی در صورت تغییر اندازه
    window.addEventListener('resize', () => {
      const container = document.getElementById('graph');
      const width = container.clientWidth;
      const height = container.clientHeight;
      d3.select('#graph svg')
        .attr('width', width)
        .attr('height', height);
      renderTree(data);
    });
  </script>
</body>
</html>`;
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#1e1e1e;color:#d4d4d4;padding:20px;font-family:sans-serif;">
  <h2>⚠️ Error</h2>
  <p>${message}</p>
  <p><button onclick="location.reload()">Retry</button></p>
</body>
</html>`;
  }

  private dispose() {
    GraphWebView.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    client: GitweClient,
  ) {
    if (GraphWebView.currentPanel) {
      GraphWebView.currentPanel.panel.reveal(vscode.ViewColumn.One);
      GraphWebView.currentPanel.updateContent();
      return;
    }
    GraphWebView.currentPanel = new GraphWebView(client, context);
  }
}
