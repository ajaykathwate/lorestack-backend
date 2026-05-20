/**
 * Finds a unique slug by fetching all existing slugs with the same prefix in a
 * single query, then incrementing a numeric suffix until a free slot is found.
 * This avoids N sequential SELECT queries for each collision.
 */
export async function generateUniqueSlug(
  base: string,
  findByPrefix: (prefix: string) => Promise<string[]>,
): Promise<string> {
  const existing = new Set(await findByPrefix(base));
  if (!existing.has(base)) return base;

  let n = 1;
  while (existing.has(`${base}-${n}`)) {
    n++;
  }
  return `${base}-${n}`;
}
