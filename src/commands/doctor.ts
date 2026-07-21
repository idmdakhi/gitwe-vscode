import * as vscode from "vscode";
import { getContainer, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

export async function runDoctorCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  const container = getContainer(folder, outputChannel);
  try {
    const report = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Gitwe: running doctor…" },
      () => container.doctorHandler.handle(),
    );

    outputChannel.appendLine("─── Gitwe doctor ───");
    for (const check of report.checks) {
      const icon = check.passed ? "✅" : "❌";
      const detail = check.detail ? ` — ${check.detail}` : "";
      outputChannel.appendLine(`${icon} ${check.name}${detail}`);
    }
    outputChannel.show(true);

    if (report.healthy) {
      void vscode.window.showInformationMessage("Gitwe: all checks passed.");
    } else {
      const failed = report.checks.filter((c) => !c.passed);
      void vscode.window.showWarningMessage(
        `Gitwe: ${failed.length} check(s) failed. See output for details.`,
        "Show Output",
      ).then((choice) => {
        if (choice === "Show Output") outputChannel.show(true);
      });
    }
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
