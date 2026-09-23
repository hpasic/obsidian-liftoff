import { describe, expect, it } from "vitest";
import { TFile, TFolder, type App } from "obsidian";
import { WorkoutStore } from "../../src/storage/workout-store";
import { workoutToFrontmatter } from "../../src/utils/frontmatter";
import { DEFAULT_SETTINGS, type Workout } from "../../src/types";

/** Just enough YAML for what workoutToFrontmatter writes: scalars, quoted strings, flow maps. */
function scalar(raw: string): unknown {
	const value = raw.trim();
	if (value.startsWith('"')) return JSON.parse(value) as string;
	if (value === "[]") return [];
	return value !== "" && !isNaN(Number(value)) ? Number(value) : value;
}

function parseFrontmatter(yaml: string): Record<string, unknown> {
	const fm: Record<string, unknown> = {};
	const exercises: Record<string, unknown>[] = [];
	for (const line of yaml.split("\n").filter((l) => l !== "---")) {
		const flow = /^ {6}- \{ (.*) \}$/.exec(line);
		const item = /^ {2}- (\w+): (.*)$/.exec(line);
		const prop = /^ {4}(\w+):(.*)$/.exec(line);
		const top = /^(\w+):(.*)$/.exec(line);
		if (flow) {
			const set = Object.fromEntries(flow[1]!.split(", ").map((pair) => {
				const [k, v] = pair.split(": ");
				return [k!, scalar(v!)];
			}));
			(exercises.at(-1)!.sets as unknown[]).push(set);
		} else if (item) {
			exercises.push({ [item[1]!]: scalar(item[2]!) });
		} else if (prop) {
			exercises.at(-1)![prop[1]!] = prop[2]!.trim() === "" ? [] : scalar(prop[2]!);
		} else if (top) {
			fm[top[1]!] = top[1] === "exercises" ? exercises : scalar(top[2]!);
		}
	}
	return fm;
}

function storeFor(workout: Workout) {
	const file = Object.assign(new TFile(), { path: "Workouts/w.md", basename: "w" });
	const folder = Object.assign(new TFolder(), { path: "Workouts", children: [file] });
	const frontmatter = parseFrontmatter(workoutToFrontmatter(workout));
	const app = {
		vault: { getAbstractFileByPath: (path: string) => (path === "Workouts" ? folder : file) },
		metadataCache: { getFileCache: () => ({ frontmatter }) },
	} as unknown as App;
	return { store: new WorkoutStore(app, () => DEFAULT_SETTINGS), file };
}

function roundTrip(workout: Workout): Workout | null {
	const { store, file } = storeFor(workout);
	return store.parseWorkoutFile(file.path);
}

const base: Workout = {
	type: "workout", template: null, date: "2026-09-23", start: "18:00",
	end: "18:40", duration: 40, exercises: [],
};

describe("WorkoutStore.parseWorkoutFile round-trip", () => {
	it("keeps weight and unit on weighted holds and defaults unweighted ones to 0", () => {
		const parsed = roundTrip({
			...base,
			exercises: [{
				name: "Farmer's Hold",
				exerciseType: "duration",
				sets: [
					{ weight: 32.5, reps: 0, unit: "lbs", completed: true, durationSeconds: 60 },
					{ weight: 0, reps: 0, unit: "lbs", completed: true, durationSeconds: 40, setType: "warmup" },
				],
			}],
		});
		expect(parsed?.exercises).toEqual([{
			name: "Farmer's Hold",
			exerciseType: "duration",
			note: undefined,
			sets: [
				{ weight: 32.5, reps: 0, unit: "lbs", completed: true, durationSeconds: 60 },
				{ weight: 0, reps: 0, unit: "kg", completed: true, durationSeconds: 40, setType: "warmup" },
			],
		}]);
	});

	it("parses note-only exercises back with no sets and their note", () => {
		const parsed = roundTrip({
			...base,
			exercises: [
				{ name: "Bench Press", note: "skipped, shoulder pain", sets: [] },
				{ name: "Plank", exerciseType: "duration", note: "outlier: sick", sets: [] },
			],
		});
		expect(parsed?.exercises).toEqual([
			{ name: "Bench Press", note: "skipped, shoulder pain", sets: [] },
			{ name: "Plank", exerciseType: "duration", note: "outlier: sick", sets: [] },
		]);
	});

	it("parses a not-started timer without config and a completed one with it", () => {
		const parsed = roundTrip({
			...base,
			exercises: [
				{ name: "Tabata", exerciseType: "timer", note: "ran out of time", sets: [] },
				{ name: "Burpees", exerciseType: "timer", sets: [], workSeconds: 40, restSeconds: 20, transitionSeconds: 0, intervals: 5 },
			],
		});
		expect(parsed?.exercises).toEqual([
			{ name: "Tabata", exerciseType: "timer", note: "ran out of time", sets: [] },
			{ name: "Burpees", exerciseType: "timer", note: undefined, sets: [], workSeconds: 40, restSeconds: 20, transitionSeconds: 0, intervals: 5 },
		]);
	});
});

describe("WorkoutStore.getRecentWorkouts", () => {
	it("counts only exercises that logged something, not note-only ones", () => {
		const { store } = storeFor({
			...base,
			exercises: [
				{ name: "Bench", sets: [{ weight: 80, reps: 5, unit: "kg", completed: true }] },
				{ name: "Dips", note: "elbow", sets: [] },
				{ name: "Tabata", exerciseType: "timer", note: "no time", sets: [] },
				{ name: "Burpees", exerciseType: "timer", sets: [], workSeconds: 40, restSeconds: 20, intervals: 5 },
			],
		});
		expect(store.getRecentWorkouts()).toEqual([expect.objectContaining({ exerciseCount: 2 })]);
	});
});
