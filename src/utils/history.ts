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
