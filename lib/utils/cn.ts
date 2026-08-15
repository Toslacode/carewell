/** Tiny class joiner. Not worth a dependency at this size. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
