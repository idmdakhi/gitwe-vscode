import type { BranchItem } from "../branchesTreeProvider";
import type { TagItem } from "../tagsTreeProvider";
import type { BranchTypeItem } from "../branchesTreeProvider";

export function resolveBranchArg(
  arg?: string | BranchItem,
): string | undefined {
  if (!arg) return undefined;
  if (typeof arg === "string") return arg;
  return arg.branchName;
}

export function resolveTagArg(arg?: string | TagItem): string | undefined {
  if (!arg) return undefined;
  if (typeof arg === "string") return arg;
  return arg.tagName;
}

export function resolveTypeArg(
  arg?: string | BranchTypeItem,
): string | undefined {
  if (!arg) return undefined;
  if (typeof arg === "string") return arg;
  return arg.typeName;
}
