import { describe, it, expect } from "vitest";
import { findLastSetsForExercise } from "../../src/utils/history";
import type { Workout } from "../../src/types";

const workouts: Workout[] = [
	{
		type: "workout",
		template: "Push Day",
		date: "2026-03-19",
		start: "14:00",
		end: "15:00",
		duration: 60,
		exercises: [
			{
				name: "Bench Press",
				sets: [
					{ weight: 80, reps: 10, unit: "kg", completed: true },
					{ weight: 90, reps: 8, unit: "kg", completed: true },
				],
			},
			{
				name: "Incline DB Press",
				sets: [
					{ weight: 30, reps: 12, unit: "kg", completed: true },
				],
			},
		],
	},
	{
		type: "workout",
		template: "Push Day",
		date: "2026-03-15",
		start: "14:00",
		end: "15:00",
		duration: 60,
		exercises: [
			{
				name: "Bench Press",
				sets: [
					{ weight: 75, reps: 10, unit: "kg", completed: true },
				],
			},
		],
	},
];

describe("findLastSetsForExercise", () => {
	it("returns sets from the most recent workout containing the exercise", () => {
		const result = findLastSetsForExercise(workouts, "Bench Press");
		expect(result).not.toBeNull();
		expect(result!.sets).toHaveLength(2);
		expect(result!.sets[0]!.weight).toBe(80);
		expect(result!.date).toBe("2026-03-19");
	});

	it("returns null for unknown exercise", () => {
		const result = findLastSetsForExercise(workouts, "Squat");
		expect(result).toBeNull();
	});

	it("matches exercise name case-insensitively", () => {
		const result = findLastSetsForExercise(workouts, "bench press");
		expect(result).not.toBeNull();
		expect(result!.sets[0]!.weight).toBe(80);
	});

	it("carries last session's note for that exercise", () => {
		const withNote = [{ ...workouts[0]!, exercises: [{ ...workouts[0]!.exercises[0]!, note: "increase weight next time" }] }];
		expect(findLastSetsForExercise(withNote, "Bench Press")!.note).toBe("increase weight next time");
		expect(findLastSetsForExercise(workouts, "Bench Press")!.note).toBeUndefined();
	});

	it("takes sets from the newest session that logged sets and the note from the newest session", () => {
		const noteOnly: Workout = {
			...workouts[0]!, date: "2026-03-26",
			exercises: [{ name: "Bench Press", note: "skipped, shoulder pain", sets: [] }],
		};
		const result = findLastSetsForExercise([noteOnly, ...workouts], "Bench Press")!;
		expect(result.sets.map((s) => [s.weight, s.reps])).toEqual([[80, 10], [90, 8]]);
		expect(result.date).toBe("2026-03-19");
		expect(result.note).toBe("skipped, shoulder pain");
		expect(result.noteDate).toBe("2026-03-26");
	});

	it("does not carry an older note past a newer session that logged sets without one", () => {
		const older: Workout = { ...workouts[1]!, exercises: [{ ...workouts[1]!.exercises[0]!, note: "old news" }] };
		const result = findLastSetsForExercise([workouts[0]!, older], "Bench Press")!;
		expect(result.note).toBeUndefined();
		expect(result.noteDate).toBe("2026-03-19");
	});

	it("takes timer config from the newest run timer, skipping a not-started one", () => {
		const timer = (date: string, extra: object): Workout => ({
			...workouts[0]!, date, exercises: [{ name: "Tabata", exerciseType: "timer", sets: [], ...extra }],
		});
		const result = findLastSetsForExercise([
			timer("2026-03-26", { note: "no time today" }),
			timer("2026-03-19", { workSeconds: 20, restSeconds: 10, transitionSeconds: 0, intervals: 8 }),
		], "Tabata")!;
		expect(result).toMatchObject({ date: "2026-03-19", workSeconds: 20, restSeconds: 10, intervals: 8, note: "no time today", noteDate: "2026-03-26" });
	});

	it("returns just the note when every session was note-only", () => {
		const noteOnly: Workout = { ...workouts[0]!, exercises: [{ name: "Dips", note: "elbow", sets: [] }] };
		expect(findLastSetsForExercise([noteOnly], "Dips")).toEqual({ date: "2026-03-19", sets: [], note: "elbow", noteDate: "2026-03-19" });
	});
});
