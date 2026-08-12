import * as vscode from "vscode";

/** Theme icon per branch type name (best-effort). */
export function iconForBranchType(typeName: string): vscode.ThemeIcon {
  const n = typeName.toLowerCase();
  if (n === "feature" || n === "feat") return new vscode.ThemeIcon("rocket");
  if (n === "release" || n === "rls") return new vscode.ThemeIcon("tag");
  if (n === "hotfix" || n === "fix" || n === "patch" || n === "bugfix") {
    return new vscode.ThemeIcon("flame");
  }
  if (n === "support" || n === "lts") return new vscode.ThemeIcon("shield");
  if (n === "bug" || n === "bugfix") return new vscode.ThemeIcon("bug");
  return new vscode.ThemeIcon("folder");
}
