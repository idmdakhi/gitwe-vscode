import * as vscode from "vscode";
import { getEngine, pickWorkspaceFolder } from "../gitweClient";
import { requireWorkspaceFolder, showGitweError } from "../util/errors";

const FIELD_SEP = "\u001f";
const FORMAT = ["%H", "%an <%ae>", "%aI", "%s"].join(FIELD_SEP);

export async function showCommitInfoCommand(outputChannel: vscode.OutputChannel): Promise<void> {
  const folder = pickWorkspaceFolder();
  if (!requireWorkspaceFolder(folder)) return;

  try {
    const engine = await getEngine(folder, outputChannel);

    const ref = await vscode.window.showInputBox({
      title: "Gitwe: Show Commit Info",
      prompt: "Branch, tag, or commit ref",
      value: "HEAD",
    });
    if (!ref) return;

    const raw = await engine.git.raw(["log", "-1", `--format=${FORMAT}`, ref]);
    const [hash, author, date, message] = raw.trim().split(FIELD_SEP);

    outputChannel.appendLine(`─── Gitwe commit info: ${ref} ───`);
    outputChannel.appendLine(`hash:    ${hash}`);
    outputChannel.appendLine(`author:  ${author}`);
    outputChannel.appendLine(`date:    ${date}`);
    outputChannel.appendLine(`message: ${message}`);
    outputChannel.show(true);
  } catch (error) {
    await showGitweError(error, outputChannel);
  }
}
