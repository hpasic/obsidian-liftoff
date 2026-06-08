import { describe, it, expect } from "vitest";
import {
	effectiveSetType,
	isWorkingSet,
	setVolume,
	estimatedOneRepMax,
	NEXT_SET_TYPE,
	computeBests,
	detectPRs,
	applyToBests,
	EMPTY_BESTS,
} from "../../src/utils/sets";
import type { Workout, WorkoutSet } from "../../src/types";

const baseSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
	weight: 80,
	reps: 10,
	unit: "kg",
	completed: true,
	...overrides,
});

describe("effectiveSetType", () => {
	it("returns 'working' when setType is undefined", () => {
		expect(effectiveSetType(baseSet())).toBe("working");
	});

	it("returns the set's setType when defined", () => {
		expect(effectiveSetType(baseSet({ setType: "warmup" }))).toBe("warmup");
		expect(effectiveSetType(baseSet({ setType: "drop" }))).toBe("drop");
	});
});

describe("isWorkingSet", () => {
	it("treats default and failure sets as working", () => {
		expect(isWorkingSet(baseSet())).toBe(true);
		expect(isWorkingSet(baseSet({ setType: "failure" }))).toBe(true);
	});

	it("excludes warmups and drop sets from PR consideration", () => {
		expect(isWorkingSet(baseSet({ setType: "warmup" }))).toBe(false);
		expect(isWorkingSet(baseSet({ setType: "drop" }))).toBe(false);
	});
});

describe("setVolume", () => {
	it("computes weight * reps for working sets", () => {
		expect(setVolume(baseSet({ weight: 100, reps: 5 }))).toBe(500);
	});

	it("includes failure sets in total volume", () => {
		expect(setVolume(baseSet({ weight: 100, reps: 5, setType: "failure" }))).toBe(500);
	});

	it("excludes warmup and drop sets from volume", () => {
		expect(setVolume(baseSet({ weight: 100, reps: 5, setType: "warmup" }))).toBe(0);
		expect(setVolume(baseSet({ weight: 100, reps: 5, setType: "drop" }))).toBe(0);
	});
});

describe("estimatedOneRepMax", () => {
	it("returns weight directly for single-rep sets", () => {
		expect(estimatedOneRepMax(100, 1)).toBe(100);
	});

	it("applies Epley for multi-rep sets", () => {
		// 100 * (1 + 10/30) = 133.33...
		expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.333, 2);
	});

	it("returns 0 for invalid inputs", () => {
		expect(estimatedOneRepMax(0, 5)).toBe(0);
		expect(estimatedOneRepMax(100, 0)).toBe(0);
	});
});

describe("NEXT_SET_TYPE cycle", () => {
	it("cycles working -> warmup -> drop -> failure -> working", () => {
		expect(NEXT_SET_TYPE.working).toBe("warmup");
		expect(NEXT_SET_TYPE.warmup).toBe("drop");
		expect(NEXT_SET_TYPE.drop).toBe("failure");
		expect(NEXT_SET_TYPE.failure).toBe("working");
	});
});

const workoutWithBench = (sets: WorkoutSet[]): Workout => ({
	type: "workout",
	template: "Push",
	date: "2026-05-20",
	start: "09:00",
	end: "10:00",
	duration: 60,
	exercises: [{ name: "Bench Press", sets }],
});

describe("computeBests", () => {
	it("returns zeros for an unknown exercise", () => {
		const w = workoutWithBench([baseSet({ weight: 100, reps: 5 })]);
		expect(computeBests([w], "Squat")).toEqual(EMPTY_BESTS);
	});

	it("tracks max weight, oneRM, and volume across workouts", () => {
		const w1 = workoutWithBench([
			baseSet({ weight: 100, reps: 5 }),
			baseSet({ weight: 110, reps: 3 }),
		]);
		const w2 = workoutWithBench([
			baseSet({ weight: 90, reps: 10 }),
		]);
		const bests = computeBests([w1, w2], "Bench Press");
		expect(bests.maxWeight).toBe(110);
		expect(bests.maxOneRM).toBeCloseTo(121, 2); // 110 * (1 + 3/30) = 121 (beats 90 * 1.333 = 120)
		expect(bests.maxVolume).toBe(900); // 90 * 10
	});

	it("excludes warmups and drop sets from bests", () => {
		const w = workoutWithBench([
			baseSet({ weight: 200, reps: 1, setType: "warmup" }),
			baseSet({ weight: 150, reps: 8, setType: "drop" }),
			baseSet({ weight: 100, reps: 5 }),
		]);
		const bests = computeBests([w], "Bench Press");
		expect(bests.maxWeight).toBe(100);
		expect(bests.maxVolume).toBe(500);
	});

	it("matches exercise names case-insensitively", () => {
		const w = workoutWithBench([baseSet({ weight: 100, reps: 5 })]);
		expect(computeBests([w], "bench press").maxWeight).toBe(100);
	});
});

describe("detectPRs", () => {
	const bests = { maxWeight: 100, maxOneRM: 120, maxVolume: 500 };

	it("returns no PRs when set ties the best", () => {
		expect(detectPRs(baseSet({ weight: 100, reps: 5 }), bests)).toEqual([]);
	});

	it("flags weight PR when weight exceeds max", () => {
		const prs = detectPRs(baseSet({ weight: 110, reps: 3 }), bests);
		expect(prs).toContain("weight");
	});

	it("flags volume PR when w*r exceeds max volume but not weight/oneRM", () => {
		// 90 * 10 = 900 volume (> 500); 90 * (1 + 10/30) = 120 (ties oneRM, not PR); 90 < 100 weight
		const prs = detectPRs(baseSet({ weight: 90, reps: 10 }), bests);
		expect(prs).toEqual(["volume"]);
	});

	it("returns no PRs for warmup sets even if numerically heaviest", () => {
		expect(detectPRs(baseSet({ weight: 999, reps: 10, setType: "warmup" }), bests)).toEqual([]);
	});

	it("returns no PRs for drop sets", () => {
		expect(detectPRs(baseSet({ weight: 999, reps: 10, setType: "drop" }), bests)).toEqual([]);
	});

	it("includes failure sets as PR-eligible", () => {
		const prs = detectPRs(baseSet({ weight: 120, reps: 5, setType: "failure" }), bests);
		expect(prs).toContain("weight");
	});
});

describe("applyToBests", () => {
	it("mutates bests to absorb a new working set", () => {
		const bests = { maxWeight: 100, maxOneRM: 120, maxVolume: 500 };
		applyToBests(baseSet({ weight: 110, reps: 5 }), bests);
		expect(bests.maxWeight).toBe(110);
	});

	it("does not absorb warmup sets", () => {
		const bests = { maxWeight: 100, maxOneRM: 120, maxVolume: 500 };
		applyToBests(baseSet({ weight: 200, reps: 5, setType: "warmup" }), bests);
		expect(bests.maxWeight).toBe(100);
	});
});
