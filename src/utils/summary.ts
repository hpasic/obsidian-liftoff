import type { Workout } from "../types";
import { applyToBests, computeBests, detectPRs, isWorkingSet, PR_LABEL, type PRKind } from "./sets";

export interface ExercisePRSummary {
	exercise: string;
	kinds: PRKind[];
}

export interface WorkoutSummary {
	durationMinutes: number | null;
	totalWorkingSets: number;
	totalVolume: number;
	unit: "kg" | "lbs";
	prs: ExercisePRSummary[];
}

/**
 * Compute summary stats for a finished workout, evaluating PRs against `history`
 * (which should NOT include the workout itself — history is the "before" state).
 */
export function buildWorkoutSummary(workout: Workout, history: Workout[]): WorkoutSummary {
	let totalWorkingSets = 0;
	let totalVolume = 0;
	let unit: "kg" | "lbs" = "kg";
	const prs: ExercisePRSummary[] = [];

	for (const exercise of workout.exercises) {
		if (exercise.exerciseType === "timer" || exercise.exerciseType === "duration") continue;

		const bests = computeBests(history, exercise.name);
		const seenKinds = new Set<PRKind>();

		for (const set of exercise.sets) {
			if (!isWorkingSet(set)) continue;
			totalWorkingSets += 1;
			totalVolume += set.weight * set.reps;
			unit = set.unit;
			for (const kind of detectPRs(set, bests)) {
				seenKinds.add(kind);
			}
			// Absorb into bests so the next set in the same exercise must beat it too
			applyToBests(set, bests);
		}

		if (seenKinds.size > 0) {
			prs.push({ exercise: exercise.name, kinds: Array.from(seenKinds) });
		}
	}

	return {
		durationMinutes: workout.duration,
		totalWorkingSets,
		totalVolume,
		unit,
		prs,
	};
}

function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatVolume(volume: number): string {
	// Trim trailing .0 but keep one decimal when meaningful
	const rounded = Math.round(volume * 10) / 10;
	const str = rounded.toLocaleString("en-US", { maximumFractionDigits: 1 });
	return str;
}

export function renderSummaryMarkdown(summary: WorkoutSummary): string {
	const lines: string[] = ["## Summary", ""];

	if (summary.durationMinutes !== null) {
		lines.push(`- **Duration**: ${formatDuration(summary.durationMinutes)}`);
	}
	lines.push(`- **Working sets**: ${summary.totalWorkingSets}`);
	lines.push(`- **Total volume**: ${formatVolume(summary.totalVolume)} ${summary.unit}`);

	if (summary.prs.length > 0) {
		const prLine = summary.prs
			.map((p) => `${p.exercise} (${p.kinds.map((k) => PR_LABEL[k]).join(", ")})`)
			.join(" · ");
		lines.push(`- **PRs**: 🏆 ${prLine}`);
	}

	return lines.join("\n");
}
