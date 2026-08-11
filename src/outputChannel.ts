import * as vscode from "vscode";
import type { Logger } from "gitwe";

/** Routes gitwe's internal logging (git commands run, hook output, etc.) into a VS Code OutputChannel. */
export function createOutputChannelLogger(channel: vscode.OutputChannel): Logger {
  const write = (level: string, message: string): void => {
    channel.appendLine(`[${level}] ${message}`);
  };

  return {
    debug: (message) => write("DEBUG", message),
    info: (message) => write("INFO", message),
    warn: (message) => write("WARN", message),
    error: (message) => write("ERROR", message),
  };
}
