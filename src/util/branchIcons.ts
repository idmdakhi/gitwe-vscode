import * as vscode from "vscode";

export function iconForBranchType(typeName: string): vscode.ThemeIcon {
  const n = typeName.toLowerCase();
  if (n.includes("feature") || n === "feat")
    return new vscode.ThemeIcon("rocket");
  if (n.includes("release") || n === "rls") return new vscode.ThemeIcon("tag");
  if (
    n.includes("hotfix") ||
    n.includes("fix") ||
    n.includes("patch") ||
    n.includes("bug")
  ) {
    return new vscode.ThemeIcon("flame");
  }
  if (n.includes("support") || n === "lts")
    return new vscode.ThemeIcon("shield");
  if (n.includes("bug") || n.includes("bugfix"))
    return new vscode.ThemeIcon("bug");
  return new vscode.ThemeIcon("folder");
}
