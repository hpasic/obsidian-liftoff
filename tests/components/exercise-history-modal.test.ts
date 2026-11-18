// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ExerciseHistoryModal } from "../../src/components/exercise-history-modal";
import type { Exercise, Workout } from "../../src/types";
import { click, element } from "../helpers/dom";

function workout(date: string, ...exercises: Exercise[]): Workout {
	return { type: "workout", template: null, date, start: "09:00", end: "10:00", duration: 60, exercises };
}

const bench = (note?: string, ...weights: number[]): Exercise => ({
	name: "Bench Press",
	note,
	sets: weights.map((weight) => ({ weight, reps: 8, unit: "kg", completed: true })),
});

function open(name: string, workouts: Workout[]) {
	new ExerciseHistoryModal({} as never, name, workouts, "kg").open();
	return element(document, ".ln-history-modal");
}

const texts = (root: ParentNode, selector: string) =>
	Array.from(root.querySelectorAll(selector), (el) => el.textContent);

describe("ExerciseHistoryModal", () => {
	it("renders bests above the sessions, newest first, with their notes", () => {
		const modal = open("Bench Press", [
			workout("2026-06-08", bench("felt strong", 85, 90)),
			workout("2026-03-20", bench(undefined, 80, 80)),
		]);
		expect(element(modal, "h3").textContent).toBe("History: Bench Press");
		const body = element(modal, ".ln-history-body");
		expect(body.firstElementChild?.classList.contains("ln-history-bests")).toBe(true);
		expect(Array.from(modal.querySelectorAll(".ln-history-best"), (el) => [
			element(el, ".ln-history-best-label").textContent,
			element(el, ".ln-history-best-value").textContent,
		])).toEqual([["Heaviest", "90 kg"], ["Est. 1RM", "114 kg"], ["Best set volume", "720 kg"]]);
		expect(texts(modal, ".ln-history-date")).toEqual(["2026-06-08", "2026-03-20"]);
		expect(texts(modal, ".ln-history-sets")).toEqual(["85×8, 90×8 kg", "80×8, 80×8 kg"]);
		const [newest, older] = Array.from(modal.querySelectorAll(".ln-history-session"));
		expect(element(newest!, ".ln-history-note").textContent).toBe("felt strong");
		expect(older!.querySelector(".ln-history-note")).toBeNull();
		expect(modal.querySelector(".ln-empty-state")).toBeNull();
	});

	it("shows a note-only session without a sets line", () => {
		const modal = open("Bench Press", [workout("2026-06-15", bench("skipped, shoulder pain"))]);
		const row = element(modal, ".ln-history-session");
		expect(row.querySelector(".ln-history-sets")).toBeNull();
		expect(element(row, ".ln-history-note").textContent).toBe("skipped, shoulder pain");
		expect(modal.querySelector(".ln-history-bests")).toBeNull();
	});

	it("says \"No sessions yet\" for an exercise without history", () => {
		const modal = open("Squat", [workout("2026-06-08", bench(undefined, 80))]);
		expect(element(modal, ".ln-empty-state").textContent).toBe("No sessions yet");
		expect(modal.querySelector(".ln-history-bests")).toBeNull();
		expect(modal.querySelector(".ln-history-session")).toBeNull();
	});

	it("closes from the Close button", () => {
		const modal = open("Squat", []);
		click(modal, ".ln-history-buttons button");
		expect(modal.isConnected).toBe(false);
		expect(modal.querySelector(".ln-history")?.childElementCount ?? 0).toBe(0);
	});
});
