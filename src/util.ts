export function formatTarget(
  target: string | string[] | null | undefined,
): string {
  if (Array.isArray(target)) return target.join(", ");
  if (typeof target === "string") return target;
  return "";
}
