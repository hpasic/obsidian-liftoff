// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ExerciseCard } from "../../src/components/exercise-card";
import { DEFAULT_SETTINGS } from "../../src/types";
import { EMPTY_BESTS } from "../../src/utils/sets";
import { click, element, exercise, input, trackIntervals, workoutSet } from "../helpers/dom";

describe("ExerciseCard", () => {
	it.each(["timer", "duration"] as const)("collapse preserves a running %s and destroy clears it exactly once", (type) => {
		const tracking = trackIntervals();
		const data = exercise("Exercise", type);
		const callbacks = { onExerciseChanged: vi.fn(), onSetCompleted: vi.fn() };
		const card = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, EMPTY_BESTS, callbacks);
		const root = card.getRootEl();
		click(root, type === "timer" ? ".ln-timer-block-start-btn" : ".ln-duration-action");
		const display = element(root, type === "timer" ? ".ln-timer-block-countdown" : ".ln-duration-display");
		click(root, ".ln-exercise-header");
		expect(root.classList.contains("ln-exercise-collapsed")).toBe(true);
		vi.advanceTimersByTime(2000);
		expect(display.textContent).toBe(type === "timer" ? "8" : "0:02");
		click(root, ".ln-exercise-header");
		expect(root.classList.contains("ln-exercise-collapsed")).toBe(false);
		expect(display.isConnected).toBe(true);
		expect(card.getExercise()).toBe(data);
		expect(tracking.ids()).toHaveLength(1);
		card.destroy();
		card.destroy();
		tracking.expectClearedOnce(tracking.ids());
		expect(vi.getTimerCount()).toBe(0);
		expect(root.isConnected).toBe(false);
	});

	it("destroy clears every running hold in a card exactly once", () => {
		const tracking = trackIntervals();
		const data = exercise("Plank", "duration");
		data.sets = [workoutSet(), workoutSet(), workoutSet()];
		const card = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, EMPTY_BESTS,
			{ onExerciseChanged: vi.fn() });
		for (const row of Array.from(card.getRootEl().querySelectorAll(".ln-duration-row"))) {
			click(row, ".ln-duration-action");
		}
		expect(tracking.ids()).toHaveLength(3);
		card.destroy();
		card.destroy();
		tracking.expectClearedOnce(tracking.ids());
		expect(vi.getTimerCount()).toBe(0);
	});

	it("writes timer edits, completion and reset through to the exercise", () => {
		const data = exercise("Intervals", "timer");
		data.intervals = 1;
		const callbacks = { onExerciseChanged: vi.fn(), onSetCompleted: vi.fn() };
		const card = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, EMPTY_BESTS, callbacks);
		input(card.getRootEl(), ".ln-timer-block-input", "2");
		expect(data.workSeconds).toBe(2);
		expect(callbacks.onExerciseChanged).toHaveBeenLastCalledWith(data);
		click(card.getRootEl(), ".ln-timer-block-start-btn");
		vi.advanceTimersByTime(12000);
		expect(data.sets).toEqual([{ weight: 0, reps: 0, unit: "kg", completed: true }]);
		expect(callbacks.onSetCompleted).toHaveBeenCalledTimes(1);
		click(card.getRootEl(), ".ln-timer-block-reset-btn");
		expect(data.sets).toEqual([]);
		card.destroy();
	});

	it("writes a completed hold through and updates the card count", () => {
		const data = exercise("Plank", "duration");
		const callbacks = { onExerciseChanged: vi.fn(), onSetCompleted: vi.fn() };
		const card = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, EMPTY_BESTS, callbacks);
		click(card.getRootEl(), ".ln-duration-action");
		vi.advanceTimersByTime(4250);
		click(card.getRootEl(), ".ln-duration-action");
		expect(data.sets[0]).toMatchObject({ durationSeconds: 4, completed: true });
		expect(callbacks.onSetCompleted).toHaveBeenCalledExactlyOnceWith(data.sets[0]);
		expect(element(card.getRootEl(), ".ln-exercise-set-count").textContent).toBe("⏱ 1/1");
		card.destroy();
	});
});
