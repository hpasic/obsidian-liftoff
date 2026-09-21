// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ExerciseCard } from "../../src/components/exercise-card";
import { DurationSetRow } from "../../src/components/duration-set-row";
import { DEFAULT_SETTINGS, type WorkoutSet } from "../../src/types";
import { EMPTY_BESTS } from "../../src/utils/sets";
import { click, element, exercise, input, trackIntervals, workoutSet } from "../helpers/dom";

function expectDurationSets(card: ExerciseCard, rows: DurationSetRow[], sets: WorkoutSet[]) {
	// Read-only inspection: all mutations go through the real DOM handlers.
	const actualRows = card["setRows"];
	const roots = Array.from(card.getRootEl().querySelectorAll(".ln-sets-container > .ln-duration-row"));
	expect(actualRows).toHaveLength(rows.length);
	expect(roots).toHaveLength(rows.length);
	expect(card.getExercise().sets).toEqual(sets);
	rows.forEach((row, index) => {
		expect(actualRows[index]).toBe(row);
		expect(roots[index]).toBe(row.getRootEl());
		expect(row.getSet()).toEqual(sets[index]);
		const type = sets[index]!.setType ?? "working";
		const label = { working: String(index + 1), warmup: "W", drop: "D", failure: "F" }[type];
		const button = element(roots[index]!, ".ln-set-number");
		expect(button.textContent).toBe(label);
		expect(button.getAttribute("aria-label")).toBe(`Set ${index + 1} (${type}). Tap to change type.`);
	});
}

describe("ExerciseCard duration set operations", () => {
	it("preserves a 90-second hold across append/removal and stops at its current index", () => {
		const tracking = trackIntervals();
		const data = exercise("Plank", "duration");
		data.sets = [workoutSet(), workoutSet(), workoutSet()];
		const callbacks = { onExerciseChanged: vi.fn(), onSetCompleted: vi.fn() };
		const card = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, EMPTY_BESTS, callbacks);
		const root = card.getRootEl();
		const rows = [...card["setRows"]] as DurationSetRow[];
		const running = rows[1]!;
		const runningRoot = running.getRootEl();
		click(runningRoot, ".ln-duration-action");
		const display = element(runningRoot, ".ln-duration-display");
		const ids = tracking.ids();
		expect(ids).toHaveLength(1);
		vi.advanceTimersByTime(90000);
		expect(display.textContent).toBe("1:30");

		expect(element(root, ".ln-add-set-btn").textContent).toBe("+ Add hold");
		click(root, ".ln-add-set-btn");
		// Pre-fix append destroys this row and clears its ticker; identity rejects that.
		rows.push(card["setRows"][3] as DurationSetRow);
		expectDurationSets(card, rows, Array.from({ length: 4 }, workoutSet));
		expect(element(runningRoot, ".ln-duration-display")).toBe(display);
		expect(tracking.ids()).toEqual(ids);
		expect(tracking.clear).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1000);
		expect(display.textContent).toBe("1:31");

		click(rows[0]!.getRootEl(), ".ln-set-remove");
		rows.shift();
		expectDurationSets(card, rows, Array.from({ length: 3 }, workoutSet));
		expect(element(runningRoot, ".ln-duration-display")).toBe(display);
		expect(tracking.ids()).toEqual(ids);
		expect(tracking.clear).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(9250);
		expect(display.textContent).toBe("1:40");
		expect(element(runningRoot, ".ln-duration-action").textContent).toBe("Stop");
		click(runningRoot, ".ln-duration-action");
		expectDurationSets(card, rows, [
			{ ...workoutSet(), durationSeconds: 100, completed: true }, workoutSet(), workoutSet(),
		]);
		expect(callbacks.onSetCompleted).toHaveBeenCalledExactlyOnceWith(data.sets[0]);
		expect(callbacks.onExerciseChanged).toHaveBeenLastCalledWith(data);
		expect(element(root, ".ln-exercise-set-count").textContent).toBe("⏱ 1/3");
		tracking.expectClearedOnce(ids);
		card.destroy();
		tracking.expectClearedOnce(ids);
		expect(tracking.start).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("removes a running hold once without clearing its sibling or clearing it again on destroy", () => {
		const tracking = trackIntervals();
		const data = exercise("Plank", "duration");
		data.sets = [workoutSet(), workoutSet()];
		const callbacks = { onExerciseChanged: vi.fn(), onSetCompleted: vi.fn() };
		const card = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, EMPTY_BESTS, callbacks);
		const [removed, sibling] = card["setRows"] as DurationSetRow[];
		click(removed!.getRootEl(), ".ln-duration-action");
		click(sibling!.getRootEl(), ".ln-duration-action");
		const ids = tracking.ids();
		expect(ids).toHaveLength(2);
		vi.advanceTimersByTime(2000);
		const removedDisplay = element(removed!.getRootEl(), ".ln-duration-display");
		const siblingDisplay = element(sibling!.getRootEl(), ".ln-duration-display");
		click(removed!.getRootEl(), ".ln-set-remove");
		tracking.expectClearedOnce([ids[0]!]);
		// Pre-fix removal also clears/rebuilds the sibling: cleanup alone would pass.
		expect(tracking.clear).toHaveBeenCalledTimes(1);
		expect(tracking.clear).not.toHaveBeenCalledWith(ids[1]);
		expect(tracking.ids()).toEqual(ids);
		expectDurationSets(card, [sibling!], [workoutSet()]);
		expect(removed!.getRootEl().isConnected).toBe(false);
		vi.advanceTimersByTime(3000);
		expect(removedDisplay.textContent).toBe("0:02");
		expect(element(sibling!.getRootEl(), ".ln-duration-display")).toBe(siblingDisplay);
		expect(siblingDisplay.textContent).toBe("0:05");
		expect(callbacks.onSetCompleted).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(1);
		card.destroy();
		card.destroy();
		tracking.expectClearedOnce(ids);
		expect(tracking.clear).toHaveBeenCalledTimes(2);
		expect(tracking.start).toHaveBeenCalledTimes(2);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([
		["first", "middle", "last"],
		["middle", "last", "first"],
		["last", "first", "middle"],
	])("keeps rows, sets and DOM parallel through %s/%s/%s removals and appends", (...positions) => {
		const data = exercise("Plank", "duration");
		data.sets = ["working", "warmup", "drop", "failure"].map((setType) =>
			({ ...workoutSet(), setType } as WorkoutSet));
		const callbacks = { onExerciseChanged: vi.fn(), onSetCompleted: vi.fn() };
		const card = new ExerciseCard(document.body, data, null, DEFAULT_SETTINGS, EMPTY_BESTS, callbacks);
		const rows = [...card["setRows"]] as DurationSetRow[];
		const sets = data.sets.map((set) => ({ ...set }));
		expectDurationSets(card, rows, sets);
		for (const position of positions) {
			const index = position === "first" ? 0 : position === "middle" ? 1 : rows.length - 1;
			const removed = rows[index]!;
			click(removed.getRootEl(), ".ln-set-remove");
			rows.splice(index, 1);
			sets.splice(index, 1);
			// Pre-fix renumbering looks correct, but replaces every surviving object/element.
			expectDurationSets(card, rows, sets);
			expect(removed.getRootEl().isConnected).toBe(false);

			// First/middle removal shifts this row; exercise both changed and completed callbacks.
			const shiftedIndex = Math.min(index, rows.length - 1);
			const shiftedRoot = rows[shiftedIndex]!.getRootEl();
			const nextType = { working: "warmup", warmup: "drop", drop: "failure", failure: "working" } as const;
			const setType = nextType[sets[shiftedIndex]!.setType ?? "working"];
			click(shiftedRoot, ".ln-set-number");
			sets[shiftedIndex] = { ...sets[shiftedIndex]!, setType };
			expectDurationSets(card, rows, sets);
			expect(callbacks.onExerciseChanged).toHaveBeenLastCalledWith(data);
			click(shiftedRoot, ".ln-duration-action");
			vi.advanceTimersByTime(2250);
			click(shiftedRoot, ".ln-duration-action");
			sets[shiftedIndex] = { ...sets[shiftedIndex]!, durationSeconds: 2, completed: true };
			expectDurationSets(card, rows, sets);
			expect(callbacks.onSetCompleted).toHaveBeenLastCalledWith(data.sets[shiftedIndex]);
			click(shiftedRoot, ".ln-duration-action"); // Reset writes through onSetChanged too.
			sets[shiftedIndex] = { ...sets[shiftedIndex]!, durationSeconds: 0, completed: false };
			expectDurationSets(card, rows, sets);

			click(card.getRootEl(), ".ln-add-set-btn");
			rows.push(card["setRows"][rows.length] as DurationSetRow);
			sets.push(workoutSet());
			expectDurationSets(card, rows, sets);
		}
		expect(callbacks.onSetCompleted).toHaveBeenCalledTimes(3);
		expect(vi.getTimerCount()).toBe(0);
		card.destroy();
	});
});

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
