import type { Exercise, Workout, WorkoutSet } from "../types";

export interface LastExerciseData {
	/** Date of the session the sets / timer config come from. */
	date: string;
	sets: WorkoutSet[];
	/** The note from the most recent session with this exercise, if any. */
	note?: string;
	/** Date of the session the note comes from — newer than `date` when that session logged nothing. */
	noteDate?: string;
	// Timer exercise data
	workSeconds?: number;
	restSeconds?: number;
	transitionSeconds?: number;
	intervals?: number;
}

/** Logged something: at least one set, or a timer that was run (config saved). */
function hasData(exercise: Exercise): boolean {
	return exercise.sets.length > 0 || exercise.workSeconds !== undefined;
}

/**
 * Find the most recent data for a given exercise from a list of workouts.
 * Workouts should be sorted newest-first. Sets and timer config come from the
 * newest session that logged any, so a note-only entry ("skipped, shoulder
 * pain") doesn't hide real history; the note comes from the newest session.
 */
export function findLastSetsForExercise(
	workouts: Workout[],
	exerciseName: string
): LastExerciseData | null {
	const nameLower = exerciseName.toLowerCase();
	let latest: { date: string; note?: string } | null = null;

	for (const workout of workouts) {
		const exercise = workout.exercises.find(
			(e) => e.name.toLowerCase() === nameLower
		);
		if (!exercise) continue;
		latest ??= { date: workout.date, note: exercise.note };
		if (!hasData(exercise)) continue;
		return {
			date: workout.date,
			sets: exercise.sets,
			note: latest.note,
			noteDate: latest.date,
			workSeconds: exercise.workSeconds,
			restSeconds: exercise.restSeconds,
			transitionSeconds: exercise.transitionSeconds,
			intervals: exercise.intervals,
		};
	}

	// Only note-only sessions: nothing to pre-fill, but the note still shows
	return latest ? { date: latest.date, sets: [], note: latest.note, noteDate: latest.date } : null;
}

export interface ExerciseSession {
	date: string;
	exercise: Exercise;
}

/**
 * One exercise from several entries of the same exercise in one workout: sets
 * and notes in order; type and timer config from the first entry with data.
 */
function mergeEntries(entries: Exercise[]): Exercise {
	if (entries.length === 1) return entries[0]!;
	const notes = entries.map((e) => e.note?.trim()).filter(Boolean);
	return {
		...(entries.find(hasData) ?? entries[0]!),
		sets: entries.flatMap((e) => e.sets),
		note: notes.length > 0 ? notes.join("\n") : undefined,
	};
}

/**
 * Every session with this exercise, in `workouts` order (newest first), at most
 * `limit`. Note-only sessions count: they were logged. A workout that repeats the
 * exercise is one session combining all its entries.
 */
export function findSessionsForExercise(
	workouts: Workout[],
	exerciseName: string,
	limit: number = Infinity
): ExerciseSession[] {
	const nameLower = exerciseName.toLowerCase();
	const sessions: ExerciseSession[] = [];
	for (const workout of workouts) {
		if (sessions.length >= limit) break;
		const entries = workout.exercises.filter((e) => e.name.toLowerCase() === nameLower);
		if (entries.length > 0) sessions.push({ date: workout.date, exercise: mergeEntries(entries) });
	}
	return sessions;
}
