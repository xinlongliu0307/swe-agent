export type Page<T> = { items: T[]; page: number; totalPages: number; hasNext: boolean };

/**
 * Return page `page` (1-based) of `items`, with `size` items per page.
 * totalPages is at least 1, even for an empty list. A page outside 1..totalPages throws a RangeError.
 */
export function paginate<T>(items: T[], page: number, size: number): Page<T> {
  const totalPages = Math.floor(items.length / size);
  const start = page * size;
  return { items: items.slice(start, start + size), page, totalPages, hasNext: page < totalPages };
}
