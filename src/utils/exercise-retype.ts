import type { Exercise, ExerciseLibraryEntry, ExerciseType } from "../types";

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
	weight: "Weight",
	timer: "Timer",
	duration: "Duration",
};

/** Same match rule as `library.ts`: names compare case-insensitively. */
function sameName(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

/**
 * Give every entry named `name` in a template's raw frontmatter `exercises`
 * the type `type`, in place, and say whether anything changed. Raw entries,
 * so the caller can edit the file's frontmatter without regenerating it. The
 * type is written explicitly, "weight" included: an entry without one falls
 * back to the library's type, which was the old type until now.
 */
export function retypeTemplateEntries(entries: unknown, name: string, type: ExerciseType): boolean {
	if (!Array.isArray(entries)) return false;
	let changed = false;
	for (const entry of entries as unknown[]) {
		if (typeof entry !== "object" || entry === null) continue;
		const ex = entry as Record<string, unknown>;
		if (!sameName(String(ex.name), name) || ex.exerciseType === type) continue;
		ex.exerciseType = type;
		changed = true;
	}
	return changed;
}

/** Point the library entry for `name` at `type`, adding the entry if missing. */
export function setLibraryExerciseType(
	library: ExerciseLibraryEntry[],
	name: string,
	type: ExerciseType
): void {
	// The library stores weight as absent, as the library editor does
	const stored = type === "weight" ? undefined : type;
	const entry = library.find((e) => sameName(e.name, name));
	if (entry) entry.exerciseType = stored;
	else library.push({ name, exerciseType: stored });
}

/**
 * Switch a live exercise to another type in place (cards hold a reference to
 * it). Completed sets are dropped, as remove + re-add would; open sets keep
 * their weight. Timer config is cleared so the timer block resolves defaults.
 */
export function retypeExercise(exercise: Exercise, type: ExerciseType, weightUnit: "kg" | "lbs"): void {
	const open = exercise.exerciseType === "timer" ? [] : exercise.sets.filter((s) => !s.completed);
	const seeds = open.length > 0 ? open : [undefined];
	exercise.exerciseType = type;
	exercise.sets = type === "timer"
		? []
		: seeds.map((s) => ({
			weight: s?.weight ?? 0,
			reps: 0,
			unit: s?.unit ?? weightUnit,
			completed: false,
			...(type === "duration" ? { durationSeconds: 0 } : {}),
		}));
	delete exercise.workSeconds;
	delete exercise.restSeconds;
	delete exercise.transitionSeconds;
	delete exercise.intervals;
	// Left/right is a weight-row option; never carry it to another type
	if (type !== "weight") delete exercise.unilateral;
}

/** Library save confirmation after a type change. */
export function typeChangeNotice(name: string, type: ExerciseType, templateCount: number): string {
	const head = `"${name}" is now a ${EXERCISE_TYPE_LABELS[type].toLowerCase()} exercise.`;
	if (templateCount === 0) return `${head} No templates needed updating.`;
	return `${head} Updated ${templateCount} template${templateCount === 1 ? "" : "s"}.`;
}
