import { describe, expect, it } from "vitest";
import { TFile, TFolder, type App } from "obsidian";
import { WorkoutStore } from "../../src/storage/workout-store";
import { workoutToFrontmatter } from "../../src/utils/frontmatter";
import { DEFAULT_SETTINGS, type Workout } from "../../src/types";
import { findLastSetsForExercise } from "../../src/utils/history";
import { buildWorkoutSummary, renderSummaryMarkdown, type WorkoutSummary } from "../../src/utils/summary";

/** Just enough YAML for what workoutToFrontmatter writes: scalars, booleans, quoted strings, flow maps. */
function scalar(raw: string): unknown {
	const value = raw.trim();
	if (value.startsWith('"')) return JSON.parse(value) as string;
	if (value === "[]") return [];
	if (value === "true" || value === "false") return value === "true";
	return value !== "" && !isNaN(Number(value)) ? Number(value) : value;
}

function parseFrontmatter(yaml: string): Record<string, unknown> {
	const fm: Record<string, unknown> = {};
	const exercises: Record<string, unknown>[] = [];
	let listKey = "";
	for (const line of yaml.split("\n").filter((l) => l !== "---")) {
		const listItem = /^ {2}- (".*")$/.exec(line);
		if (listItem) {
			(fm[listKey] as unknown[]).push(scalar(listItem[1]!));
			continue;
		}
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
			listKey = top[1]!;
			fm[listKey] = top[1] === "exercises" ? exercises : top[2]!.trim() === "" ? [] : scalar(top[2]!);
		}
	}
	return fm;
}

function storeFor(workout: Workout, summary?: WorkoutSummary) {
	const file = Object.assign(new TFile(), {
		path: "Workouts/w.md", basename: "w",
		stat: { mtime: new Date(`${workout.date}T${workout.start}`).getTime() },
	});
	const folder = Object.assign(new TFolder(), { path: "Workouts", children: [file] });
	const frontmatter = parseFrontmatter(workoutToFrontmatter(workout, summary));
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
	it("keeps left and right reps on a unilateral exercise and feeds both to the next session", () => {
		const lunge = {
			name: "Walking Lunge", unilateral: true, note: undefined,
			sets: [{ weight: 20, reps: 10, repsRight: 8, unit: "kg" as const, completed: true }],
		};
		const parsed = roundTrip({ ...base, exercises: [lunge] });
		expect(parsed?.exercises).toEqual([lunge]);
		expect(findLastSetsForExercise([parsed!], "walking lunge")?.sets).toEqual(lunge.sets);
	});

	it("loads a note without repsRight unchanged", () => {
		const bench = { name: "Bench", note: undefined, sets: [{ weight: 80, reps: 5, unit: "kg" as const, completed: true }] };
		const parsed = roundTrip({ ...base, exercises: [bench] });
		expect(parsed?.exercises).toEqual([bench]);
		expect(parsed?.exercises[0]).not.toHaveProperty("unilateral");
		expect(parsed?.exercises[0]!.sets[0]).not.toHaveProperty("repsRight");
	});

	it("keeps a stopped-early timer's config and marker through markdown and parsing", () => {
		const timer = {
			name: "Tabata", exerciseType: "timer" as const, sets: [],
			note: "feeling tired\nTimer stopped early.",
			workSeconds: 40, restSeconds: 20, transitionSeconds: 5, intervals: 3,
		};
		expect(roundTrip({ ...base, exercises: [timer] })?.exercises).toEqual([timer]);
	});

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

describe("summary properties in frontmatter", () => {
	const STAT_KEYS = ["total_volume", "volume_unit", "working_sets", "pr_count", "prs", "exercise_names"];
	// 100 kg x 5 plus 225 lbs x 3 (~102.06 kg x 3), both new bests against empty history
	const mixed: Workout = {
		...base,
		exercises: [
			{ name: "Bench Press", sets: [
				{ weight: 100, reps: 5, unit: "kg", completed: true },
				{ weight: 225, reps: 3, unit: "lbs", completed: true },
			] },
			{ name: "Tabata", exerciseType: "timer", sets: [], workSeconds: 40, restSeconds: 20, intervals: 5 },
		],
	};

	it("writes the six properties from the same summary that renders ## Summary", () => {
		const summary = buildWorkoutSummary(mixed, [], "kg");
		const fm = parseFrontmatter(workoutToFrontmatter(mixed, summary));
		const volumeLine = /\*\*Total volume\*\*: ([\d,.]+) (\w+)/.exec(renderSummaryMarkdown(summary))!;
		expect(fm.total_volume).toBe(Number(volumeLine[1]!.replace(/,/g, "")));
		expect(fm.volume_unit).toBe(volumeLine[2]);
		expect(fm).toMatchObject({
			volume_unit: "kg",
			working_sets: 2,
			pr_count: 3,
			prs: ["Bench Press: Weight PR", "Bench Press: 1RM PR", "Bench Press: Volume PR"],
			exercise_names: ["Bench Press", "Tabata"],
		});
		expect(fm.total_volume).toBeCloseTo(500 + 225 * 0.45359237 * 3, 0);
	});

	it("writes volume in the settings unit", () => {
		const fm = parseFrontmatter(workoutToFrontmatter(mixed, buildWorkoutSummary(mixed, [], "lbs")));
		expect(fm.volume_unit).toBe("lbs");
		expect(fm.total_volume).toBeCloseTo(100 / 0.45359237 * 5 + 225 * 3, 0);
	});

	it("keeps colons and quotes in exercise names and PR strings through the round trip", () => {
		const tricky = `Farmer's "Heavy" Carry: Day 2`;
		const w: Workout = { ...base, exercises: [{ name: tricky, sets: [{ weight: 40, reps: 8, unit: "kg", completed: true }] }] };
		const fm = parseFrontmatter(workoutToFrontmatter(w, buildWorkoutSummary(w, [], "kg")));
		expect(fm.exercise_names).toEqual([tricky]);
		expect(fm.prs).toContain(`${tricky}: Weight PR`);
	});

	it("writes empty lists when there are no PRs and no exercises", () => {
		const empty = parseFrontmatter(workoutToFrontmatter(base, buildWorkoutSummary(base, [], "kg")));
		expect(empty).toMatchObject({ total_volume: 0, working_sets: 0, pr_count: 0, prs: [], exercise_names: [] });
	});

	it("rewrites the properties when the same workout is saved again with a new summary", () => {
		const first = parseFrontmatter(workoutToFrontmatter(mixed, buildWorkoutSummary(mixed, [], "kg")));
		const again = parseFrontmatter(workoutToFrontmatter(mixed, buildWorkoutSummary(mixed, [mixed], "kg")));
		expect(first.pr_count).toBe(3);
		expect(again.pr_count).toBe(0);
		expect(again.prs).toEqual([]);
	});

	it("loads a workout the same with or without the properties", () => {
		expect(roundTrip(mixed)).toEqual(storeFor(mixed, buildWorkoutSummary(mixed, [], "kg")).store.parseWorkoutFile("Workouts/w.md"));
	});

	it("leaves a note from an older version without the properties unchanged", () => {
		const fm = parseFrontmatter(workoutToFrontmatter(mixed));
		for (const key of STAT_KEYS) expect(fm).not.toHaveProperty(key);
		expect(workoutToFrontmatter(mixed)).not.toMatch(/total_volume|pr_count|exercise_names/);
		const { store, file } = storeFor(mixed);
		expect(store.getRecentWorkouts()).toEqual([expect.objectContaining({ exerciseCount: 2, duration: 40 })]);
		expect(store.parseWorkoutFile(file.path)?.exercises).toHaveLength(2);
	});
});

describe("WorkoutStore.getRecentWorkouts", () => {
	it("orders same-day notes totally: valid starts first by start, the rest by mtime", () => {
		// A < C < B < A under the old pairwise rule; the result depended on folder order
		const notes = [
			{ name: "A", start: "18:00", mtime: "19:00" },
			{ name: "B", start: undefined, mtime: "20:00" },
			{ name: "C", start: "08:00", mtime: "21:00" },
			{ name: "D", start: "invalid", mtime: "22:00" },
		];
		const files = notes.map((n) => Object.assign(new TFile(), {
			path: `Workouts/${n.name}.md`, basename: n.name,
			stat: { mtime: new Date(`2026-09-24T${n.mtime}`).getTime() },
		}));
		const frontmatter = notes.map((n) => ({ type: "workout", date: base.date, start: n.start, exercises: [] }));
		const orders = [files, [...files].reverse(), [files[1]!, files[3]!, files[0]!, files[2]!]];
		for (const children of orders) {
			const folder = Object.assign(new TFolder(), { children });
			const app = {
				vault: { getAbstractFileByPath: () => folder },
				metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: frontmatter[files.indexOf(file)] }) },
			} as unknown as App;
			const store = new WorkoutStore(app, () => DEFAULT_SETTINGS);
			expect(store.getRecentWorkouts().map((w) => w.filename)).toEqual(["A", "C", "D", "B"]);
		}
	});

	it.each([undefined, "invalid"])("ranks the note with a valid start newer (other: %s)", (otherStart) => {
		const files = ["valid", "other"].map((name, i) => Object.assign(new TFile(), {
			path: `Workouts/${name}.md`, basename: name,
			stat: { mtime: new Date(`2026-09-24T${i === 0 ? "20:00" : "19:00"}`).getTime() },
		}));
		const frontmatter = files.map((_, i) => ({
			type: "workout", date: base.date, start: i === 0 ? "08:00" : otherStart, exercises: [],
		}));
		// Both input orders agree.
		for (const children of [files, [...files].reverse()]) {
			const folder = Object.assign(new TFolder(), { children });
			const app = {
				vault: { getAbstractFileByPath: () => folder },
				metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: frontmatter[files.indexOf(file)] }) },
			} as unknown as App;
			const store = new WorkoutStore(app, () => DEFAULT_SETTINGS);
			expect(store.getRecentWorkouts().map((w) => w.path)).toEqual(files.map((f) => f.path));
			expect(store.getRecentWorkouts(1)[0]!.path).toBe(files[0]!.path);
		}
	});

	it.each([
		["08:00", "18:00"],
		[undefined, undefined],
		["invalid", "invalid"],
	] as const)("uses later same-day session for history (start: %s / %s)", (earlyStart, lateStart) => {
		const early: Workout = {
			...base, start: "08:00",
			exercises: [{ name: "Bench", sets: [{ weight: 80, reps: 5, unit: "kg", completed: true }] }],
		};
		const late: Workout = {
			...early, start: "18:00",
			exercises: [{ name: "Bench", sets: [{ weight: 90, reps: 5, unit: "kg", completed: true }] }],
		};
		const files = [early, late].map((workout, i) => Object.assign(new TFile(), {
			path: `Workouts/${i}.md`, basename: String(i),
			stat: { mtime: new Date(`${workout.date}T${workout.start}`).getTime() },
		}));
		const frontmatter = [early, late].map((workout, i) => ({
			...parseFrontmatter(workoutToFrontmatter(workout)), start: [earlyStart, lateStart][i],
		}));
		// Valid start times must win even when the morning note was edited later.
		if (earlyStart === "08:00") files[0]!.stat.mtime = files[1]!.stat.mtime + 1000;
		const folder = Object.assign(new TFolder(), { children: files });
		const app = {
			vault: { getAbstractFileByPath: (path: string) => path === "Workouts" ? folder : files.find((f) => f.path === path) },
			metadataCache: { getFileCache: (file: TFile) => ({ frontmatter: frontmatter[files.indexOf(file)] }) },
		} as unknown as App;
		const store = new WorkoutStore(app, () => DEFAULT_SETTINGS);
		expect(store.getRecentWorkouts().map((w) => w.path)).toEqual([files[1]!.path, files[0]!.path]);
		expect(store.getRecentWorkouts(1)[0]!.path).toBe(files[1]!.path);
		const history = store.getRecentWorkouts().map((w) => store.parseWorkoutFile(w.path)!);
		expect(findLastSetsForExercise(history, "Bench")?.sets[0]!.weight).toBe(90);
	});

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
