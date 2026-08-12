/**
 * Approximate branch-type capabilities until gitwe-ts exposes them on BranchType.
 * Driven by type name + whether the type has merge targets.
 */

export interface BranchCapabilities {
  start: boolean;
  finish: boolean;
  publish: boolean;
  pull: boolean;
  track: boolean;
  delete: boolean;
  checkout: boolean;
  rebase: boolean;
}

export function capabilitiesForType(
  typeName: string,
  hasTargets: boolean,
): BranchCapabilities {
  const name = typeName.toLowerCase();
  if (name === "support" || name === "lts") {
    return {
      start: true,
      finish: false,
      publish: true,
      pull: true,
      track: true,
      delete: true,
      checkout: true,
      rebase: true,
    };
  }
  if (!hasTargets) {
    return {
      start: true,
      finish: false,
      publish: true,
      pull: true,
      track: true,
      delete: true,
      checkout: true,
      rebase: true,
    };
  }
  return {
    start: true,
    finish: true,
    publish: true,
    pull: true,
    track: true,
    delete: true,
    checkout: true,
    rebase: true,
  };
}

export function branchContextValue(
  caps: BranchCapabilities,
  isRemote: boolean,
): string {
  if (isRemote) return "gitweRemoteBranch";
  const flags: string[] = ["gitweBranch"];
  if (caps.finish) flags.push("canFinish");
  if (caps.publish) flags.push("canPublish");
  if (caps.pull) flags.push("canUpdate");
  if (caps.rebase) flags.push("canRebase");
  if (caps.delete) flags.push("canDelete");
  return flags.join(" ");
}
