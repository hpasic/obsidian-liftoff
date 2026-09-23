import { describe, expect, it } from "vitest";
import { TFile, type App } from "obsidian";
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

function roundTrip(workout: Workout): Workout | null {
	const file = Object.assign(new TFile(), { path: "Workouts/w.md", basename: "w" });
	const frontmatter = parseFrontmatter(workoutToFrontmatter(workout));
	const app = {
		vault: { getAbstractFileByPath: () => file },
		metadataCache: { getFileCache: () => ({ frontmatter }) },
	} as unknown as App;
	return new WorkoutStore(app, () => DEFAULT_SETTINGS).parseWorkoutFile(file.path);
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
});
