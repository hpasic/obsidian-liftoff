import type { SetType, Workout, WorkoutSet } from "../types";

export type PRKind = "weight" | "oneRM" | "volume";

export interface PRBests {
	maxWeight: number;
	maxOneRM: number;
	maxVolume: number;
}

export const EMPTY_BESTS: PRBests = {
	maxWeight: 0,
	maxOneRM: 0,
	maxVolume: 0,
};

export function effectiveSetType(set: WorkoutSet): SetType {
	return set.setType ?? "working";
}

export function isWorkingSet(set: WorkoutSet): boolean {
	const t = effectiveSetType(set);
	return t === "working" || t === "failure";
}

export function setVolume(set: WorkoutSet): number {
	const t = effectiveSetType(set);
	if (t === "warmup" || t === "drop") return 0;
	return set.weight * set.reps;
}

export function estimatedOneRepMax(weight: number, reps: number): number {
	if (weight <= 0 || reps <= 0) return 0;
	if (reps === 1) return weight;
	return weight * (1 + reps / 30);
}

export const NEXT_SET_TYPE: Record<SetType, SetType> = {
	working: "warmup",
	warmup: "drop",
	drop: "failure",
	failure: "working",
};

export const SET_TYPE_LABEL: Record<SetType, string> = {
	working: "",
	warmup: "W",
	drop: "D",
	failure: "F",
};

/**
 * Compute personal-best totals across all sets in `workouts` for one exercise.
 * Warmups and drop sets are skipped (they don't count toward PRs).
 */
export function computeBests(workouts: Workout[], exerciseName: string): PRBests {
	const nameLower = exerciseName.toLowerCase();
	const bests: PRBests = { ...EMPTY_BESTS };
	for (const workout of workouts) {
		for (const exercise of workout.exercises) {
			if (exercise.name.toLowerCase() !== nameLower) continue;
			for (const set of exercise.sets) {
				if (!isWorkingSet(set)) continue;
				if (set.weight <= 0 || set.reps <= 0) continue;
				if (set.weight > bests.maxWeight) bests.maxWeight = set.weight;
				const oneRM = estimatedOneRepMax(set.weight, set.reps);
				if (oneRM > bests.maxOneRM) bests.maxOneRM = oneRM;
				const vol = set.weight * set.reps;
				if (vol > bests.maxVolume) bests.maxVolume = vol;
			}
		}
	}
	return bests;
}

/**
 * Return the PR kinds beaten by `set` vs `bests`. Warmups and drops never PR.
 * Strict inequality — tying a previous best isn't a PR.
 */
export function detectPRs(set: WorkoutSet, bests: PRBests): PRKind[] {
	if (!isWorkingSet(set)) return [];
	if (set.weight <= 0 || set.reps <= 0) return [];
	const kinds: PRKind[] = [];
	if (set.weight > bests.maxWeight) kinds.push("weight");
	if (estimatedOneRepMax(set.weight, set.reps) > bests.maxOneRM) kinds.push("oneRM");
	if (set.weight * set.reps > bests.maxVolume) kinds.push("volume");
	return kinds;
}

/** Mutate `bests` to absorb a newly-completed set. */
export function applyToBests(set: WorkoutSet, bests: PRBests): void {
	if (!isWorkingSet(set)) return;
	if (set.weight <= 0 || set.reps <= 0) return;
	if (set.weight > bests.maxWeight) bests.maxWeight = set.weight;
	const oneRM = estimatedOneRepMax(set.weight, set.reps);
	if (oneRM > bests.maxOneRM) bests.maxOneRM = oneRM;
	const vol = set.weight * set.reps;
	if (vol > bests.maxVolume) bests.maxVolume = vol;
}

export const PR_LABEL: Record<PRKind, string> = {
	weight: "Weight PR",
	oneRM: "1RM PR",
	volume: "Volume PR",
};
