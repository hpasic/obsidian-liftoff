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
});
