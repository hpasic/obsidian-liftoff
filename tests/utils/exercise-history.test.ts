import { describe, expect, it } from "vitest";
import { buildExerciseHistory } from "../../src/utils/exercise-history";
import type { Exercise, Workout, WorkoutSet } from "../../src/types";

function workout(date: string, ...exercises: Exercise[]): Workout {
	return { type: "workout", template: null, date, start: "09:00", end: "10:00", duration: 60, exercises };
}

function set(weight: number, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
	return { weight, reps, unit: "kg", completed: true, ...extra };
}

function hold(seconds: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
	return { weight: 0, reps: 0, unit: "kg", completed: true, durationSeconds: seconds, ...extra };
}

const bench = (...sets: WorkoutSet[]): Exercise => ({ name: "Bench Press", sets });

describe("buildExerciseHistory: weight exercises", () => {
	it("lists sessions newest first as compact sets with one shared unit, bests on top", () => {
		const history = buildExerciseHistory([
			workout("2026-06-08", bench(set(80, 8), set(80, 8), set(85, 6))),
			workout("2026-03-20", bench(set(75, 10)), { name: "Squat", sets: [set(140, 5)] }),
		], "bench press", "kg");
		expect(history.sessions).toEqual([
			{ date: "2026-06-08", sets: "80×8, 80×8, 85×6 kg", note: undefined },
			{ date: "2026-03-20", sets: "75×10 kg", note: undefined },
		]);
		// e1RM: 85 × (1 + 6/30) = 102 beats 80 × (1 + 8/30) ≈ 101.3; volume: 75 × 10
		expect(history.bests).toEqual([
			{ label: "Heaviest", value: "85 kg" },
			{ label: "Est. 1RM", value: "102 kg" },
			{ label: "Best set volume", value: "750 kg" },
		]);
	});

	it("gives each weight its own unit when a session mixes kg and lbs, and shows bests in the default unit", () => {
		const history = buildExerciseHistory([
			workout("2026-06-08", bench(set(80, 8), set(180, 6, { unit: "lbs" }))),
		], "Bench Press", "lbs");
		expect(history.sessions[0]!.sets).toBe("80 kg×8, 180 lbs×6");
		// 180 lbs (81.6 kg) is the heaviest; 80 kg × 8 wins e1RM (101.3 kg) and volume (640 kg)
		expect(history.bests).toEqual([
			{ label: "Heaviest", value: "180 lbs" },
			{ label: "Est. 1RM", value: "223.4 lbs" },
			{ label: "Best set volume", value: "1,411 lbs" },
		]);
	});

	it("reads all-bodyweight sessions as reps and marks bodyweight sets in weighted ones", () => {
		const history = buildExerciseHistory([
			workout("2026-06-08", { name: "Dips", sets: [set(0, 12), set(20, 8)] }),
			workout("2026-06-01", { name: "Dips", sets: [set(0, 15), set(0, 10)] }),
		], "Dips", "kg");
		expect(history.sessions.map((s) => s.sets)).toEqual(["BW×12, 20×8 kg", "15, 10 reps"]);
		expect(history.bests).toContainEqual({ label: "Bodyweight reps", value: "15" });
	});

	it("shows left / right reps and set-type labels; warmups and drops stay out of the bests", () => {
		const history = buildExerciseHistory([
			workout("2026-06-08", {
				name: "Split Squat", unilateral: true, sets: [
					set(100, 1, { repsRight: 1, setType: "warmup" }),
					set(20, 10, { repsRight: 8 }),
					set(20, 9, { repsRight: 9, setType: "failure" }),
					set(10, 12, { repsRight: 12, setType: "drop" }),
				],
			}),
		], "Split Squat", "kg");
		expect(history.sessions[0]!.sets).toBe("W 100×1 / 1, 20×10 / 8, F 20×9 / 9, D 10×12 / 12 kg");
		expect(history.bests[0]).toEqual({ label: "Heaviest", value: "20 kg" });
	});

	it("keeps the note (trimmed) and note-only sessions", () => {
		const history = buildExerciseHistory([
			workout("2026-06-15", { name: "Bench Press", sets: [], note: "  skipped, shoulder pain \n" }),
			workout("2026-06-08", { ...bench(set(80, 8)), note: "  " }),
		], "Bench Press", "kg");
		expect(history.sessions).toEqual([
			{ date: "2026-06-15", sets: "", note: "skipped, shoulder pain" },
			{ date: "2026-06-08", sets: "80×8 kg", note: undefined },
		]);
	});

	it("lists the latest 10 sessions while bests cover every workout passed in", () => {
		const workouts = Array.from({ length: 12 }, (_, i) =>
			workout(`2026-05-${String(30 - i).padStart(2, "0")}`, bench(set(i === 11 ? 120 : 80, 5))));
		const history = buildExerciseHistory(workouts, "Bench Press", "kg");
		expect(history.sessions.map((s) => s.date)).toEqual(workouts.slice(0, 10).map((w) => w.date));
		expect(history.bests[0]).toEqual({ label: "Heaviest", value: "120 kg" });
	});

	it("is empty without history", () => {
		expect(buildExerciseHistory([workout("2026-06-08", bench(set(80, 8)))], "Squat", "kg"))
			.toEqual({ bests: [], sessions: [] });
	});
});

describe("buildExerciseHistory: holds and timers", () => {
	it("lists hold times, weighted ones with their weight, and the longest working hold as the best", () => {
		const plank = (...sets: WorkoutSet[]): Exercise => ({ name: "Plank", exerciseType: "duration", sets });
		const history = buildExerciseHistory([
			workout("2026-06-08", plank(hold(120, { setType: "warmup" }), hold(45), hold(60, { weight: 20 }))),
			workout("2026-06-01", plank(hold(50, { weight: 45, unit: "lbs" }))),
		], "Plank", "kg");
		expect(history.sessions.map((s) => s.sets)).toEqual(["W 2:00, 0:45, 1:00 @ 20 kg", "0:50 @ 45 lbs"]);
		expect(history.bests).toEqual([{ label: "Longest hold", value: "1:00" }]);
	});

	it("shows the work / rest / intervals a timer ran, nothing for a never-started one, and no bests", () => {
		const timer = (extra: Partial<Exercise>): Exercise => ({ name: "Tabata", exerciseType: "timer", sets: [], ...extra });
		const history = buildExerciseHistory([
			workout("2026-06-15", timer({ note: "no time today" })),
			workout("2026-06-08", timer({ workSeconds: 40, restSeconds: 20, transitionSeconds: 5, intervals: 6 })),
			workout("2026-06-01", timer({ workSeconds: 90, restSeconds: 30, transitionSeconds: 0, intervals: 5, note: "Timer stopped early." })),
		], "Tabata", "kg");
		expect(history.sessions).toEqual([
			{ date: "2026-06-15", sets: "", note: "no time today" },
			{ date: "2026-06-08", sets: "6 × 0:40 work / 0:20 rest / 0:05 switch", note: undefined },
			{ date: "2026-06-01", sets: "5 × 1:30 work / 0:30 rest", note: "Timer stopped early." },
		]);
		expect(history.bests).toEqual([]);
	});
});
