const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_SEARCH_CHARACTERS = /[^a-z0-9]+/g;

export function normalizeSearchKeyword(...values: Array<unknown>): string {
  const searchableValues: Array<string | number> = [];
  for (const value of values) {
    const candidates: unknown[] = Array.isArray(value) ? value : [value];
    for (const candidate of candidates) {
      if (typeof candidate === "string" || typeof candidate === "number") {
        searchableValues.push(candidate);
      }
    }
  }
  return searchableValues
    .map((value) => String(value))
    .join(" ")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(NON_SEARCH_CHARACTERS, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function matchesSearchKeyword(
  keyword: string | null | undefined,
  search: string,
): boolean {
  const normalizedSearch = normalizeSearchKeyword(search);
  return !normalizedSearch || Boolean(keyword?.includes(normalizedSearch));
}
