// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ExerciseCard } from "../../src/components/exercise-card";
import { SetRow } from "../../src/components/set-row";
import { DEFAULT_SETTINGS, type Exercise, type WorkoutSet } from "../../src/types";
import { EMPTY_BESTS } from "../../src/utils/sets";
import type { LastExerciseData } from "../../src/utils/history";
import { click, element, input } from "../helpers/dom";

const lungeSet = (overrides: Partial<WorkoutSet> = {}): WorkoutSet =>
	({ weight: 20, reps: 0, repsRight: 0, unit: "kg", completed: false, ...overrides });

function card(exercise: Exercise, lastData: LastExerciseData | null = null) {
	const onExerciseChanged = vi.fn();
	const c = new ExerciseCard(document.body, exercise, lastData, DEFAULT_SETTINGS, EMPTY_BESTS, { onExerciseChanged });
	return { root: c.getRootEl(), onExerciseChanged };
}

const lastLunge: LastExerciseData = {
	date: "2026-10-20",
	sets: [{ weight: 20, reps: 10, repsRight: 8, unit: "kg", completed: true }],
};

describe("SetRow unilateral", () => {
	it("renders one reps input for a bilateral set", () => {
		const row = new SetRow(document.body, 1, { weight: 0, reps: 5, unit: "kg", completed: false }, null,
			{ onSetChanged: vi.fn(), onSetCompleted: vi.fn(), onSetRemoved: vi.fn() });
		expect(row.getRootEl().querySelectorAll(".ln-reps-input")).toHaveLength(1);
		expect(row.getRootEl().querySelector(".ln-set-reps-lr")).toBeNull();
		expect(row.getSet()).not.toHaveProperty("repsRight");
	});

	it("renders L and R inputs and saves both sides on check", () => {
		const onSetCompleted = vi.fn();
		const row = new SetRow(document.body, 1, { weight: 20, reps: 0, unit: "kg", completed: false }, null,
			{ onSetChanged: vi.fn(), onSetCompleted, onSetRemoved: vi.fn() }, { unilateral: true });
		const root = row.getRootEl();
		const left = element<HTMLInputElement>(root, ".ln-set-reps-lr .ln-reps-left");
		const right = element<HTMLInputElement>(root, ".ln-set-reps-lr .ln-reps-right");
		expect([left.placeholder, right.placeholder]).toEqual(["L", "R"]);
		expect([left.getAttribute("aria-label"), right.getAttribute("aria-label")]).toEqual(["Left reps", "Right reps"]);
		input(root, ".ln-reps-left", "10");
		input(root, ".ln-reps-right", "8");
		click(root, ".ln-set-check");
		expect(onSetCompleted).toHaveBeenCalledWith({ weight: 20, reps: 10, repsRight: 8, unit: "kg", completed: true });
	});
});

describe("ExerciseCard unilateral", () => {
	it("labels the reps column L / R and shows both sides in the Previous hint and placeholders", () => {
		const { root } = card({ name: "Walking Lunge", unilateral: true, sets: [lungeSet()] }, lastLunge);
		const headers = Array.from(root.querySelectorAll(".ln-set-header span"), (el) => el.textContent);
		expect(headers).toEqual(["SET", "WEIGHT", "L / R"]);
		expect(element(root, ".ln-exercise-previous").textContent).toBe("Previous: 20 kg x 10 / 8");
		expect(element<HTMLInputElement>(root, ".ln-reps-left").placeholder).toBe("10");
		expect(element<HTMLInputElement>(root, ".ln-reps-right").placeholder).toBe("8");
	});

	it("shows carried-over sides and gives an added set both sides", () => {
		const data: Exercise = { name: "Walking Lunge", unilateral: true, sets: [lungeSet({ reps: 10, repsRight: 8 })] };
		const { root } = card(data, lastLunge);
		expect(element<HTMLInputElement>(root, ".ln-reps-left").value).toBe("10");
		expect(element<HTMLInputElement>(root, ".ln-reps-right").value).toBe("8");
		click(root, ".ln-add-set-btn");
		expect(data.sets[1]).toEqual({ weight: 20, reps: 0, repsRight: 0, unit: "kg", completed: false });
		const rows = root.querySelectorAll(".ln-sets-container .ln-set-row");
		expect(rows[1]!.querySelectorAll(".ln-set-reps-lr .ln-reps-input")).toHaveLength(2);
	});

	it("flags a PR on the weaker side only", () => {
		const data: Exercise = { name: "Walking Lunge", unilateral: true, sets: [lungeSet({ weight: 0 })] };
		const bests = { ...EMPTY_BESTS, maxBodyweightReps: 8 };
		const c = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, bests, { onExerciseChanged: vi.fn() });
		const root = c.getRootEl();
		input(root, ".ln-reps-left", "12");
		input(root, ".ln-reps-right", "8");
		click(root, ".ln-set-check");
		expect(root.querySelector(".ln-pr-badge")).toBeNull();
		click(root, ".ln-set-check");
		input(root, ".ln-reps-right", "9");
		click(root, ".ln-set-check");
		expect(element(root, ".ln-pr-badge-label").textContent).toBe("Rep PR");
	});

	it("keeps a bilateral card's header and hint unchanged", () => {
		const { root } = card({ name: "Bench", sets: [{ weight: 0, reps: 0, unit: "kg", completed: false }] },
			{ date: "2026-10-20", sets: [{ weight: 60, reps: 10, unit: "kg", completed: true }] });
		expect(Array.from(root.querySelectorAll(".ln-set-header span"), (el) => el.textContent)).toEqual(["SET", "WEIGHT", "REPS"]);
		expect(element(root, ".ln-exercise-previous").textContent).toBe("Previous: 60 kg x 10");
	});
});
