import type { ExerciseLibraryEntry } from "../types";
import { normalizeName, type CatalogExercise } from "./exercise-catalog";

/** Gym shorthand the dataset spells out, so "db curl" finds "Dumbbell curl". */
const TOKEN_ALIASES: Record<string, string> = {
	db: "dumbbell",
	bb: "barbell",
	kb: "kettlebell",
	bw: "body weight",
	ez: "ez barbell",
	ohp: "overhead press",
	rdl: "romanian deadlift",
	sldl: "stiff leg deadlift",
};

/** Query words, lower-cased. Every word must match somewhere (token AND). */
export function tokenizeQuery(query: string): string[] {
	return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** True when every token is a substring of the haystack (or of its expansion). */
export function matchesTokens(haystack: string, tokens: string[]): boolean {
	return tokens.every((token) => {
		if (haystack.includes(token)) return true;
		const alias = TOKEN_ALIASES[token];
		return alias !== undefined && haystack.includes(alias);
	});
}

/**
 * A library entry that matches a catalog name is the same exercise, so it
 * borrows that row's metadata: the user's "Barbell bench press" is findable by
 * "pectorals" and survives the "chest" chip even though the stored entry holds
 * nothing but a name. Entries with no catalog twin match on name alone and
 * stay hidden while a chip is active — there is nothing to filter them by.
 */
export function filterLibrary(
	library: ExerciseLibraryEntry[],
	catalogByName: Map<string, CatalogExercise>,
	filter: { tokens: string[]; bodyPart: string | null }
): ExerciseLibraryEntry[] {
	return library.filter((entry) => {
		const twin = catalogByName.get(normalizeName(entry.name));
		if (filter.bodyPart !== null && twin?.bodyPart !== filter.bodyPart) return false;
		const haystack = twin ? `${entry.name.toLowerCase()} ${twin.haystack}` : entry.name.toLowerCase();
		return matchesTokens(haystack, filter.tokens);
	});
}

export interface CatalogFilter {
	tokens: string[];
	/** Active body-part chip, or null for "any". */
	bodyPart: string | null;
	/** Lower-cased names already in the user's library — those rows are theirs. */
	excludeNames: Set<string>;
	limit: number;
}

export interface CatalogFilterResult {
	items: CatalogExercise[];
	/** Matches before the render cap, so the UI can say how many were hidden. */
	total: number;
}

/**
 * Catalog rows matching the query and chip, minus anything the user already
 * owns. Names collide case-insensitively and the user's entry always wins.
 *
 * Matches are ranked before the cap is applied: a hit in the name beats a hit
 * that only came from the target/equipment text, and shorter names win ties —
 * "db curl" should land on "Dumbbell curl", not on its 40 variants. Without a
 * query the catalog's own alphabetical order is kept.
 */
export function filterCatalog(
	catalog: CatalogExercise[],
	filter: CatalogFilter
): CatalogFilterResult {
	const matches: CatalogExercise[] = [];
	for (const exercise of catalog) {
		if (filter.bodyPart !== null && exercise.bodyPart !== filter.bodyPart) continue;
		if (filter.excludeNames.has(normalizeName(exercise.name))) continue;
		if (!matchesTokens(exercise.haystack, filter.tokens)) continue;
		matches.push(exercise);
	}

	if (filter.tokens.length > 0) {
		const nameHit = new Map<CatalogExercise, number>(
			matches.map((e) => [e, matchesTokens(e.name.toLowerCase(), filter.tokens) ? 0 : 1])
		);
		matches.sort(
			(a, b) =>
				(nameHit.get(a) ?? 0) - (nameHit.get(b) ?? 0) ||
				a.name.length - b.name.length ||
				a.name.localeCompare(b.name)
		);
	}

	return { items: matches.slice(0, filter.limit), total: matches.length };
}
