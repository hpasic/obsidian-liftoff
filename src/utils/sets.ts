import type { SetType, Workout, WorkoutSet } from "../types";

export type PRKind = "weight" | "oneRM" | "volume" | "reps";

export interface PRBests {
	/** Weighted bests are stored in kg (volume in kg × reps). */
	maxWeight: number;
	maxOneRM: number;
	maxVolume: number;
	maxBodyweightReps: number;
}

export const EMPTY_BESTS: PRBests = {
	maxWeight: 0,
	maxOneRM: 0,
	maxVolume: 0,
	maxBodyweightReps: 0,
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

export function toKg(weight: number, unit: "kg" | "lbs"): number {
	return unit === "lbs" ? weight * 0.45359237 : weight;
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
				if (set.weight < 0 || set.reps <= 0) continue;
				if (set.weight === 0) {
					if (set.reps > bests.maxBodyweightReps) bests.maxBodyweightReps = set.reps;
					continue;
				}
				const weight = toKg(set.weight, set.unit);
				if (weight > bests.maxWeight) bests.maxWeight = weight;
				const oneRM = estimatedOneRepMax(weight, set.reps);
				if (oneRM > bests.maxOneRM) bests.maxOneRM = oneRM;
				const vol = weight * set.reps;
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
	if (set.weight < 0 || set.reps <= 0) return [];
	if (set.weight === 0) return set.reps > bests.maxBodyweightReps ? ["reps"] : [];
	const kinds: PRKind[] = [];
	const weight = toKg(set.weight, set.unit);
	if (weight > bests.maxWeight) kinds.push("weight");
	if (estimatedOneRepMax(weight, set.reps) > bests.maxOneRM) kinds.push("oneRM");
	if (weight * set.reps > bests.maxVolume) kinds.push("volume");
	return kinds;
}

/** Mutate `bests` to absorb a newly-completed set. */
export function applyToBests(set: WorkoutSet, bests: PRBests): void {
	if (!isWorkingSet(set)) return;
	if (set.weight < 0 || set.reps <= 0) return;
	if (set.weight === 0) {
		if (set.reps > bests.maxBodyweightReps) bests.maxBodyweightReps = set.reps;
		return;
	}
	const weight = toKg(set.weight, set.unit);
	if (weight > bests.maxWeight) bests.maxWeight = weight;
	const oneRM = estimatedOneRepMax(weight, set.reps);
	if (oneRM > bests.maxOneRM) bests.maxOneRM = oneRM;
	const vol = weight * set.reps;
	if (vol > bests.maxVolume) bests.maxVolume = vol;
}

export const PR_LABEL: Record<PRKind, string> = {
	weight: "Weight PR",
	oneRM: "1RM PR",
	volume: "Volume PR",
	reps: "Rep PR",
};
