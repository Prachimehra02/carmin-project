import { supabase } from "../lib/supabase";

export interface Tag {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TagInput {
  name: string;
  slug: string;
  active: boolean;
}

export interface DuplicateCheckResult {
  isExactName: boolean;
  isExactSlug: boolean;
  exactMatchTag: Tag | null;
  similarTag: Tag | null;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalize a word for similarity comparison: lowercase, trim,
 * strip non-alpha characters, collapse singular/plural and common
 * spelling variations.
 */
function normalizeForSimilarity(input: string): string {
  let s = input.toLowerCase().trim().replace(/[^a-z]/g, "");

  // Collapse common singular/plural suffixes
  const pluralRules: [RegExp, string][] = [
    [/ies$/, "y"],   // vases -> vase, stories -> story
    [/es$/, ""],     // boxes -> box, vases -> vase (after ies rule)
    [/s$/, ""],      // vases -> vase (general)
  ];
  for (const [re, repl] of pluralRules) {
    if (re.test(s)) {
      s = s.replace(re, repl);
      break;
    }
  }

  return s;
}

/**
 * Check if two names are "similar" — i.e. could be duplicates that
 * an admin typed slightly differently. This catches:
 *   - Singular/plural: "Vase" vs "Vases"
 *   - Minor spelling differences: "Ceramic" vs "Ceramik"
 *   - The same word with/without trailing 's'
 *   - Levenshtein distance of 1-2 characters
 */
function isSimilarName(a: string, b: string): boolean {
  const na = normalizeForSimilarity(a);
  const nb = normalizeForSimilarity(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const dist = levenshtein(na, nb);
  const threshold = Math.max(1, Math.floor(Math.max(na.length, nb.length) * 0.2));
  return dist <= threshold;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export { generateSlug };

/**
 * Check a candidate name/slug against a list of existing tags.
 * Excludes the tag with `excludeId` (used when editing).
 * Includes inactive tags in the check.
 */
export function checkForDuplicates(
  name: string,
  slug: string,
  existingTags: Tag[],
  excludeId?: number
): DuplicateCheckResult {
  const candidates = existingTags.filter((t) => t.id !== excludeId);
  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();

  const nameMatch = candidates.find(
    (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
  );
  const slugMatch = candidates.find(
    (t) => t.slug.toLowerCase() === trimmedSlug.toLowerCase()
  );

  const isExactName = !!nameMatch;
  const isExactSlug = !!slugMatch;
  const exactMatchTag = nameMatch ?? slugMatch ?? null;

  let similarTag: Tag | null = null;
  if (!isExactName && !isExactSlug) {
    similarTag =
      candidates.find(
        (t) =>
          isSimilarName(trimmedName, t.name) ||
          isSimilarName(trimmedSlug, t.slug)
      ) ?? null;
  }

  return { isExactName, isExactSlug, exactMatchTag, similarTag };
}

/**
 * Parse a Supabase/Postgres error and return a human-readable message
 * when it's a unique-constraint violation, otherwise rethrow.
 */
function handleUniqueViolation(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("duplicate key") || msg.includes("unique constraint") || msg.includes("23505")) {
    throw new Error(
      "A tag with this name or slug already exists in the database. " +
      "Please choose a different name or slug."
    );
  }
  throw err;
}

export async function fetchAllTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug, active, created_at, updated_at")
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function createTag(input: TagInput): Promise<Tag> {
  const { data, error } = await supabase
    .from("tags")
    .insert([input])
    .select("id, name, slug, active, created_at, updated_at")
    .single();

  if (error) handleUniqueViolation(error);
  return data;
}

export async function updateTag(
  id: number,
  input: Partial<TagInput>
): Promise<void> {
  const { error } = await supabase
    .from("tags")
    .update(input)
    .eq("id", id);
  if (error) handleUniqueViolation(error);
}

export async function fetchActiveTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug, active, created_at, updated_at")
    .eq("active", true)
    .order("name");

  if (error) throw error;

  return data || [];
}