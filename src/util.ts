export function toArray(
  target: string | string[] | null | undefined,
  delimiter: string = ", ",
): string[] {
  if (Array.isArray(target)) return [...target];

  if (typeof target === "string") {
    if (target.includes(delimiter)) {
      return target
        .split(delimiter)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [target];
  }

  return [];
}

export function toString(
  target: string | string[] | null | undefined,
  delimiter: string = ", ",
): string {
  if (Array.isArray(target)) return target.join(delimiter);
  if (typeof target === "string") return target;
  return "";
}
