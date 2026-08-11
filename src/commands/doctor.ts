import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function runDoctorCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);
    const report = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Gitwe: running doctor…" },
      () => engine.overview(),
    );

    outputChannel.appendLine("─── Gitwe doctor ───");
    for (const check of report.health) {
      const icon = check.level === "ok" ? "✅" : check.level === "warning" ? "⚠️" : "❌";
      outputChannel.appendLine(`${icon} ${check.message}`);
    }
    outputChannel.show(true);

    const failed = report.health.filter((c) => c.level !== "ok");
    if (failed.length === 0) {
      void vscode.window.showInformationMessage("Gitwe: all checks passed.");
    } else {
      void vscode.window
        .showWarningMessage(`Gitwe: ${failed.length} issue(s) found. See output for details.`, "Show Output")
        .then((choice) => {
          if (choice === "Show Output") outputChannel.show(true);
        });
    }
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
