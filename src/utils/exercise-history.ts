import type { Exercise, Workout, WorkoutSet } from "../types";
import { findSessionsForExercise } from "./history";
import { computeBests, effectiveSetType, formatReps, isWorkingSet, SET_TYPE_LABEL, toKg } from "./sets";

/** Sessions the history modal lists. */
export const HISTORY_SESSION_LIMIT = 10;

export interface HistoryBest {
	label: string;
	value: string;
}

export interface HistorySession {
	date: string;
	/** Compact sets, e.g. `80×8, 80×8, 85×6 kg`. Empty for a note-only session. */
	sets: string;
	note?: string;
}

export interface ExerciseHistory {
	bests: HistoryBest[];
	/** Newest first, at most HISTORY_SESSION_LIMIT. */
	sessions: HistorySession[];
}

/**
 * Bests and the latest sessions of one exercise, as display text. `workouts`
 * is newest first; weighted bests are shown in `unit`, set weights as logged.
 */
export function buildExerciseHistory(workouts: Workout[], exerciseName: string, unit: "kg" | "lbs"): ExerciseHistory {
	const sessions = findSessionsForExercise(workouts, exerciseName);
	return {
		bests: formatBests(workouts, exerciseName, unit, sessions.map((s) => s.exercise)),
		sessions: sessions.slice(0, HISTORY_SESSION_LIMIT).map(({ date, exercise }) => ({
			date,
			sets: formatSessionSets(exercise),
			note: exercise.note?.trim() || undefined,
		})),
	};
}

function formatBests(workouts: Workout[], exerciseName: string, unit: "kg" | "lbs", exercises: Exercise[]): HistoryBest[] {
	const bests = computeBests(workouts, exerciseName);
	// Bests are kept in kg; show them in the default unit
	const weight = (kg: number) => `${formatNumber(kg / toKg(1, unit))} ${unit}`;
	const shown: HistoryBest[] = [];
	if (bests.maxWeight > 0) shown.push({ label: "Heaviest", value: weight(bests.maxWeight) });
	if (bests.maxOneRM > 0) shown.push({ label: "Est. 1RM", value: weight(bests.maxOneRM) });
	if (bests.maxVolume > 0) shown.push({ label: "Best set volume", value: weight(bests.maxVolume) });
	if (bests.maxBodyweightReps > 0) shown.push({ label: "Bodyweight reps", value: String(bests.maxBodyweightReps) });

	// Holds: the longest one, warmups and drops excluded like the other bests
	let longestHold = 0;
	for (const exercise of exercises) {
		for (const set of exercise.sets) {
			if (isWorkingSet(set)) longestHold = Math.max(longestHold, set.durationSeconds ?? 0);
		}
	}
	if (longestHold > 0) shown.push({ label: "Longest hold", value: formatTime(longestHold) });
	return shown;
}

/** One session's sets on one line, in the shape its exercise type logs. */
function formatSessionSets(exercise: Exercise): string {
	if (exercise.exerciseType === "timer") {
		// Never run: saved for its note only
		if (exercise.workSeconds === undefined) return "";
		const t = exercise.transitionSeconds ?? 0;
		const switchPart = t > 0 ? ` / ${formatTime(t)} switch` : "";
		return `${exercise.intervals ?? 0} × ${formatTime(exercise.workSeconds)} work / ${formatTime(exercise.restSeconds ?? 0)} rest${switchPart}`;
	}
	if (exercise.exerciseType === "duration") {
		return exercise.sets
			.map((set) => {
				const weight = set.weight > 0 ? ` @ ${set.weight} ${set.unit}` : "";
				return `${typePrefix(set)}${formatTime(set.durationSeconds ?? 0)}${weight}`;
			})
			.join(", ");
	}
	return formatWeightSets(exercise.sets);
}

/**
 * `80×8, 85×6 kg` with one shared unit at the end; each weight carries its own
 * unit when the session mixes kg and lbs. Bodyweight sets read `BW×12`, or
 * `12, 10 reps` when the whole session was bodyweight.
 */
function formatWeightSets(sets: WorkoutSet[]): string {
	if (sets.length === 0) return "";
	const units = new Set(sets.filter((s) => s.weight > 0).map((s) => s.unit));
	const sharedUnit = units.size === 1 ? [...units][0]! : null;
	const parts = sets.map((set) => {
		const reps = formatReps(set);
		let text: string;
		if (set.weight <= 0) text = units.size === 0 ? reps : `BW×${reps}`;
		else text = sharedUnit ? `${set.weight}×${reps}` : `${set.weight} ${set.unit}×${reps}`;
		return `${typePrefix(set)}${text}`;
	});
	const suffix = units.size === 0 ? " reps" : sharedUnit ? ` ${sharedUnit}` : "";
	return `${parts.join(", ")}${suffix}`;
}

/** `W ` / `D ` / `F ` before warmup, drop and failure sets, as on the set rows. */
function typePrefix(set: WorkoutSet): string {
	const label = SET_TYPE_LABEL[effectiveSetType(set)];
	return label ? `${label} ` : "";
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

/** One decimal at most, thousands grouped: `101.3`, `1,920`. */
function formatNumber(value: number): string {
	return (Math.round(value * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
}
