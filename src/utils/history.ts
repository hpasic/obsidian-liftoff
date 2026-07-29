import type { Workout, WorkoutSet } from "../types";

export interface LastExerciseData {
	date: string;
	sets: WorkoutSet[];
	// Timer exercise data
	workSeconds?: number;
	restSeconds?: number;
	transitionSeconds?: number;
	intervals?: number;
}

/**
 * Find the most recent data for a given exercise from a list of workouts.
 * Workouts should be sorted newest-first.
 */
export function findLastSetsForExercise(
	workouts: Workout[],
	exerciseName: string
): LastExerciseData | null {
	const nameLower = exerciseName.toLowerCase();

	for (const workout of workouts) {
		const exercise = workout.exercises.find(
			(e) => e.name.toLowerCase() === nameLower
		);
		if (exercise) {
			return {
				date: workout.date,
				sets: exercise.sets,
				workSeconds: exercise.workSeconds,
				restSeconds: exercise.restSeconds,
				transitionSeconds: exercise.transitionSeconds,
				intervals: exercise.intervals,
			};
		}
	}

	return null;
}
