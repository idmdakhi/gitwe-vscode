import * as vscode from "vscode";
import type { Logger } from "gitwe";

/** Routes gitwe's internal logging (git commands run, hook output, etc.) into a VS Code OutputChannel. */
export function createOutputChannelLogger(channel: vscode.OutputChannel): Logger {
  const write = (level: string, message: string, meta?: Record<string, unknown>): void => {
    const suffix = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    channel.appendLine(`[${level}] ${message}${suffix}`);
  };

  return {
    debug: (message, meta) => write("DEBUG", message, meta),
    info: (message, meta) => write("INFO", message, meta),
    warn: (message, meta) => write("WARN", message, meta),
    error: (message, meta) => write("ERROR", message, meta),
  };
}
