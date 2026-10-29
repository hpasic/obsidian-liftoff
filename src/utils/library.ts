import type { ExerciseLibraryEntry, TemplateExercise } from "../types";

/**
 * Add a saved template's exercises to the library. `catalogNames` (lower-cased)
 * are the ones picked from the built-in catalog: new entries get
 * `source: "catalog"`, as in the workout view. An existing entry's source is
 * never changed — absent means user-created.
 */
export function addTemplateExercisesToLibrary(
	library: ExerciseLibraryEntry[],
	exercises: TemplateExercise[],
	catalogNames: ReadonlySet<string>
): void {
	for (const ex of exercises) {
		const source = catalogNames.has(ex.name.toLowerCase()) ? "catalog" : undefined;
		const existing = library.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
		if (!existing) {
			const entry: ExerciseLibraryEntry = { name: ex.name, exerciseType: ex.exerciseType, source };
			if (ex.unilateral) entry.unilateral = true;
			library.push(entry);
			continue;
		}
		if (!existing.exerciseType && ex.exerciseType) {
			existing.exerciseType = ex.exerciseType;
		}
		if (!existing.unilateral && ex.unilateral) {
			existing.unilateral = true;
		}
	}
}
