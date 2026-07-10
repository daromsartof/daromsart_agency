/** Initiales à partir d'un nom (« Marie Curie » → « MC »). */
export function initials(name: string | null | undefined, max = 2): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, max)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
