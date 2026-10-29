import { describe, it, expect } from "vitest";
import { buildWorkoutSummary, renderSummaryMarkdown } from "../../src/utils/summary";
import type { Workout, WorkoutSet } from "../../src/types";

const set = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
	weight: 100,
	reps: 5,
	unit: "kg",
	completed: true,
	...overrides,
});

const workout = (exercises: Workout["exercises"], duration: number | null = 60): Workout => ({
	type: "workout",
	template: "Push",
	date: "2026-05-25",
	start: "09:00",
	end: "10:00",
	duration,
	exercises,
});

describe("buildWorkoutSummary", () => {
	it.each(["kg", "lbs"] as const)("sums mixed-unit working volume in %s regardless of row order", (unit) => {
		const sets = [
			set({ weight: 50, reps: 5, unit: "kg" }),
			set({ weight: 100, reps: 10, unit: "lbs", setType: "failure" }),
			set({ weight: 200, reps: 20, unit: "lbs", setType: "warmup" }),
			set({ weight: 200, reps: 20, unit: "kg", setType: "drop" }),
		];
		const expected = unit === "kg" ? 703.59237 : 1551.155655462194;
		for (const ordered of [sets, [...sets].reverse()]) {
			const summary = buildWorkoutSummary(workout([{ name: "Bench", sets: ordered }]), [], unit);
			expect(summary.totalWorkingSets).toBe(2);
			expect(summary.totalVolume).toBeCloseTo(expected, 8);
			expect(summary.unit).toBe(unit);
		}
	});

	it.each(["kg", "lbs"] as const)("preserves exact summary markdown for a workout entirely in %s", (unit) => {
		const w = workout([{ name: "Bench", sets: [set({ unit }), set({ weight: 102.5, unit })] }]);
		expect(renderSummaryMarkdown(buildWorkoutSummary(w, [], unit))).toBe([
			"## Summary", "",
			"- **Duration**: 1h",
			"- **Working sets**: 2",
			`- **Total volume**: 1,012.5 ${unit}`,
			"- **PRs**: 🏆 Bench (Weight PR, 1RM PR, Volume PR)",
		].join("\n"));
	});

	it("renders a bodyweight rep PR in the workout summary", () => {
		const history = [workout([{ name: "Pull-ups", sets: [set({ weight: 0, reps: 8 })] }])];
		const w = workout([{ name: "Pull-ups", sets: [8, 9, 9].map((reps) => set({ weight: 0, reps })) }]);
		const summary = buildWorkoutSummary(w, history, "kg");
		expect(summary.prs).toEqual([{ exercise: "Pull-ups", kinds: ["reps"] }]);
		expect(renderSummaryMarkdown(summary)).toContain("Pull-ups (Rep PR)");
	});

	it("counts working sets and totals their volume", () => {
		const w = workout([
			{
				name: "Bench Press",
				sets: [
					set({ weight: 100, reps: 5 }),
					set({ weight: 100, reps: 5 }),
					set({ weight: 50, reps: 10, setType: "warmup" }),
				],
			},
		]);
		const summary = buildWorkoutSummary(w, [], "kg");
		expect(summary.totalWorkingSets).toBe(2);
		expect(summary.totalVolume).toBe(1000);
		expect(summary.durationMinutes).toBe(60);
	});

	it("detects PRs against history but not against earlier sets in the same workout", () => {
		const history = [
			workout([{ name: "Squat", sets: [set({ weight: 100, reps: 5 })] }]),
		];
		const w = workout([
			{
				name: "Squat",
				sets: [
					set({ weight: 110, reps: 5 }),
					set({ weight: 120, reps: 5 }),
				],
			},
		]);
		const summary = buildWorkoutSummary(w, history, "kg");
		expect(summary.prs).toHaveLength(1);
		expect(summary.prs[0]!.exercise).toBe("Squat");
		expect(summary.prs[0]!.kinds).toContain("weight");
	});

	it("ignores timer exercises in volume/PR calc", () => {
		const w = workout([
			{
				name: "Burpees",
				exerciseType: "timer",
				sets: [],
				workSeconds: 40,
				restSeconds: 20,
				intervals: 5,
			},
		]);
		const summary = buildWorkoutSummary(w, [], "kg");
		expect(summary.totalWorkingSets).toBe(0);
		expect(summary.totalVolume).toBe(0);
		expect(summary.prs).toHaveLength(0);
	});

	it("ignores duration exercises in working-set count and volume", () => {
		const w = workout([
			{
				name: "Plank",
				exerciseType: "duration",
				sets: [
					set({ weight: 0, reps: 0, durationSeconds: 30 }),
					set({ weight: 0, reps: 0, durationSeconds: 45 }),
				],
			},
			{ name: "Bench", sets: [set({ weight: 100, reps: 5 })] },
		]);
		const summary = buildWorkoutSummary(w, [], "kg");
		expect(summary.totalWorkingSets).toBe(1);
		expect(summary.totalVolume).toBe(500);
	});

	it("excludes warmup sets from volume", () => {
		const w = workout([
			{
				name: "Bench",
				sets: [
					set({ weight: 40, reps: 10, setType: "warmup" }),
					set({ weight: 100, reps: 5 }),
				],
			},
		]);
		const summary = buildWorkoutSummary(w, [], "kg");
		expect(summary.totalVolume).toBe(500);
		expect(summary.totalWorkingSets).toBe(1);
	});
});

describe("renderSummaryMarkdown", () => {
	it("formats duration over an hour as Xh Ym", () => {
		const md = renderSummaryMarkdown({
			durationMinutes: 75,
			totalWorkingSets: 10,
			totalVolume: 4850,
			unit: "kg",
			prs: [],
		});
		expect(md).toContain("## Summary");
		expect(md).toContain("**Duration**: 1h 15m");
		expect(md).toContain("**Working sets**: 10");
		expect(md).toContain("**Total volume**: 4,850 kg");
		expect(md).not.toContain("PRs");
	});

	it("emits a PR line with trophy when PRs are present", () => {
		const md = renderSummaryMarkdown({
			durationMinutes: 60,
			totalWorkingSets: 5,
			totalVolume: 2000,
			unit: "kg",
			prs: [{ exercise: "Squat", kinds: ["weight", "oneRM"] }],
		});
		expect(md).toContain("🏆");
		expect(md).toContain("Squat");
		expect(md).toContain("Weight PR");
		expect(md).toContain("1RM PR");
	});

	it("omits duration line when duration is null", () => {
		const md = renderSummaryMarkdown({
			durationMinutes: null,
			totalWorkingSets: 0,
			totalVolume: 0,
			unit: "kg",
			prs: [],
		});
		expect(md).not.toContain("Duration");
	});
});

describe("buildWorkoutSummary unilateral", () => {
	it("sums weight × (left + right) and PRs on the weaker side", () => {
		const history = workout([{ name: "Walking Lunge", unilateral: true, sets: [set({ weight: 20, reps: 8, repsRight: 8 })] }]);
		const today = workout([{ name: "Walking Lunge", unilateral: true, sets: [set({ weight: 20, reps: 10, repsRight: 8 })] }]);
		const summary = buildWorkoutSummary(today, [history], "kg");
		expect(summary.totalVolume).toBe(360);
		// 8 reps on the weak side ties last time's e1RM; only the two-sided volume beats it
		expect(summary.prs).toEqual([{ exercise: "Walking Lunge", kinds: ["volume"] }]);
	});
});
