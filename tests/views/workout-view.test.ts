// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceLeaf } from "obsidian";
import type LiftOffPlugin from "../../src/main";
import { WorkoutView } from "../../src/views/workout-view";
import { DEFAULT_SETTINGS, type Exercise, type Workout } from "../../src/types";
import { DurationSetRow } from "../../src/components/duration-set-row";
import { click, element, exercise, input, menuAction, trackIntervals } from "../helpers/dom";

const views: WorkoutView[] = [];
afterEach(async () => {
	for (const view of views.splice(0)) await view.onClose();
});

function setup(exercises: Exercise[] = []) {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, exerciseLibrary: [] },
		workoutStore: { getRecentWorkouts: vi.fn(() => []) },
		persistActiveWorkout: vi.fn().mockResolvedValue(undefined),
		saveSettings: vi.fn().mockResolvedValue(undefined),
	};
	const workout: Workout = {
		type: "workout", template: null, date: "2026-09-21", start: "12:00",
		end: null, duration: null, exercises,
	};
	const view = new WorkoutView({ app: {} } as unknown as WorkspaceLeaf, plugin as unknown as LiftOffPlugin);
	document.body.appendChild(view.containerEl);
	view.resume({ workout, startTimeMs: Date.now() });
	views.push(view);
	return { view, workout, plugin, root: view.containerEl };
}

function add(root: HTMLElement, name: string, type: "weight" | "timer" | "duration" = "weight") {
	click(root, ".ln-add-exercise-btn");
	input(document, ".ln-exercise-search", name);
	const selector = type === "weight"
		? ".ln-exercise-create:not(.ln-exercise-create-timer):not(.ln-exercise-create-duration)"
		: `.ln-exercise-create-${type}`;
	click(document, selector);
	vi.advanceTimersByTime(50); // Picker's focus timeout is unrelated to interval ownership.
}

function expectParallel(view: WorkoutView, workout: Workout, names: string[]) {
	// Read-only inspection proves the actual three collections agree, even for duplicate names.
	const cards = view["exerciseCards"];
	expect(workout.exercises.map((item) => item.name)).toEqual(names);
	expect(cards).toHaveLength(names.length);
	const roots = Array.from(view.containerEl.querySelectorAll(".ln-exercises > .ln-exercise-card"));
	cards.forEach((card, index) => {
		expect(card.getExercise()).toBe(workout.exercises[index]);
		expect(card.getRootEl()).toBe(roots[index]);
		expect(element(roots[index]!, ".ln-exercise-name").textContent).toBe(names[index]);
	});
}

describe("WorkoutView structure", () => {
	it("keeps exercises, cards and DOM index-parallel through add/move/remove sequences", () => {
		const { view, workout, root } = setup();
		add(root, "Squat");
		expectParallel(view, workout, ["Squat"]);
		add(root, "Intervals", "timer");
		expectParallel(view, workout, ["Squat", "Intervals"]);
		add(root, "Plank", "duration");
		expectParallel(view, workout, ["Squat", "Intervals", "Plank"]);
		const [squat, timer, plank] = view["exerciseCards"];
		menuAction(plank!.getRootEl(), "Move up");
		expectParallel(view, workout, ["Squat", "Plank", "Intervals"]);
		menuAction(plank!.getRootEl(), "Move up");
		expectParallel(view, workout, ["Plank", "Squat", "Intervals"]);
		menuAction(plank!.getRootEl(), "Move down");
		expectParallel(view, workout, ["Squat", "Plank", "Intervals"]);
		menuAction(squat!.getRootEl(), "Remove exercise");
		expectParallel(view, workout, ["Plank", "Intervals"]);
		add(root, "Row");
		expectParallel(view, workout, ["Plank", "Intervals", "Row"]);
		menuAction(timer!.getRootEl(), "Move down");
		expectParallel(view, workout, ["Plank", "Row", "Intervals"]);
		menuAction(timer!.getRootEl(), "Remove exercise");
		expectParallel(view, workout, ["Plank", "Row"]);
		menuAction(plank!.getRootEl(), "Remove exercise");
		expectParallel(view, workout, ["Row"]);
		menuAction(view["exerciseCards"][0]!.getRootEl(), "Remove exercise");
		expectParallel(view, workout, []);
	});

	it("resolves duplicate-name card callbacks and movement bounds at click time", () => {
		const { view, workout } = setup([exercise("Same"), exercise("Same")]);
		const [first, second] = view["exerciseCards"];
		menuAction(first!.getRootEl(), "Move down");
		expectParallel(view, workout, ["Same", "Same"]);
		expect(view["exerciseCards"][0]).toBe(second);
		click(first!.getRootEl(), ".ln-exercise-menu-btn");
		expect(Array.from(document.querySelectorAll(".menu button")).map((el) => el.textContent))
			.toEqual(["Move up", "Remove exercise"]);
		click(document, ".menu button");
		expect(view["exerciseCards"][0]).toBe(first);
		menuAction(second!.getRootEl(), "Remove exercise");
		expectParallel(view, workout, ["Same"]);
		expect(view["exerciseCards"][0]).toBe(first);
	});

	it("preserves running timer and hold objects, state and intervals across structural operations", () => {
		const tracking = trackIntervals();
		const { view, workout, root } = setup([exercise("Timer", "timer"), exercise("Hold", "duration"), exercise("Other")]);
		const [timerCard, holdCard, other] = view["exerciseCards"];
		const timer = timerCard!["timerBlock"]!;
		const hold = holdCard!["setRows"][0] as DurationSetRow;
		click(timerCard!.getRootEl(), ".ln-timer-block-start-btn");
		click(hold.getRootEl(), ".ln-duration-action");
		vi.advanceTimersByTime(2000);
		const timerState = { ...timer };
		const holdState = { ...hold };
		const holdSet = hold["set"];
		const holdSetSnapshot = hold.getSet();
		const timerExercise = timerCard!.getExercise();
		const holdExercise = holdCard!.getExercise();
		const timerSets = timerExercise.sets;
		const holdSets = holdExercise.sets;
		const saved = structuredClone([timerExercise, holdExercise]);
		const ids = tracking.ids();

		add(root, "New");
		menuAction(timerCard!.getRootEl(), "Move down");
		menuAction(holdCard!.getRootEl(), "Move down");
		menuAction(other!.getRootEl(), "Remove exercise");
		expectParallel(view, workout, ["Timer", "Hold", "New"]);
		expect(timerCard!["timerBlock"]).toBe(timer);
		expect(holdCard!["setRows"][0]).toBe(hold);
		expect(hold["set"]).toBe(holdSet);
		expect(hold.getSet()).toEqual(holdSetSnapshot);
		expect({ ...timer }).toEqual(timerState);
		expect({ ...hold }).toEqual(holdState);
		expect(timerCard!.getExercise()).toBe(timerExercise);
		expect(holdCard!.getExercise()).toBe(holdExercise);
		expect(timerExercise.sets).toBe(timerSets);
		expect(holdExercise.sets).toBe(holdSets);
		expect([timerExercise, holdExercise]).toEqual(saved);
		expect(tracking.ids()).toEqual(ids);
		expect(tracking.clear).not.toHaveBeenCalled();
		vi.advanceTimersByTime(2000);
		expect(element(timerCard!.getRootEl(), ".ln-timer-block-countdown").textContent).toBe("6");
		expect(element(hold.getRootEl(), ".ln-duration-display").textContent).toBe("0:04");
	});

	it("removes the selected card after it moves while confirmation is open", async () => {
		const { view, workout } = setup([exercise("A"), exercise("B"), exercise("C")]);
		const card = view["exerciseCards"][1]!;
		click(card.getRootEl(), ".ln-set-check");
		menuAction(card.getRootEl(), "Remove exercise");
		menuAction(card.getRootEl(), "Move up");
		click(document, ".modal .mod-cta");
		await Promise.resolve();
		expectParallel(view, workout, ["A", "C"]);
		expect(card.getRootEl().isConnected).toBe(false);
	});
});

describe("WorkoutView rest timer", () => {
	it("follows its owner through moves/removals and stops only when that owner is removed", async () => {
		const tracking = trackIntervals();
		const { view, workout } = setup([exercise("A"), exercise("B"), exercise("C"), exercise("D")]);
		const [a, b, owner, d] = view["exerciseCards"];
		click(owner!.getRootEl(), ".ln-set-check");
		const rest = element(view.containerEl, ".ln-rest-timer");
		const restId = tracking.ids().at(-1)!;
		vi.advanceTimersByTime(2000);
		menuAction(owner!.getRootEl(), "Move up");
		expect(rest.previousElementSibling).toBe(owner!.getRootEl());
		menuAction(a!.getRootEl(), "Move down"); // Displaces the owner.
		expect(rest.previousElementSibling).toBe(owner!.getRootEl());
		menuAction(owner!.getRootEl(), "Move down");
		expect(rest.previousElementSibling).toBe(owner!.getRootEl());
		menuAction(a!.getRootEl(), "Remove exercise"); // Before owner.
		expect(rest.previousElementSibling).toBe(owner!.getRootEl());
		menuAction(d!.getRootEl(), "Remove exercise"); // After owner.
		expect(rest.previousElementSibling).toBe(owner!.getRootEl());
		expectParallel(view, workout, ["C", "B"]);
		expect(tracking.clear).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1000);
		expect(element(rest, ".ln-rest-timer-value").textContent).toBe("0:03");
		menuAction(owner!.getRootEl(), "Remove exercise");
		click(document, ".modal .mod-cta");
		await Promise.resolve();
		expectParallel(view, workout, ["B"]);
		expect(rest.isConnected).toBe(false);
		tracking.expectClearedOnce([restId]);
		expect(vi.getTimerCount()).toBe(1); // Workout elapsed timer remains.
		click(b!.getRootEl(), ".ln-set-check"); // Callback uses its new index.
		expect(rest.previousElementSibling).toBe(b!.getRootEl());
		click(rest, ".ln-rest-timer-dismiss");
		tracking.expectClearedOnce([restId, tracking.ids().at(-1)!]);
	});

	it("restarts rest for the latest completed card and preserves it across renderWorkout", () => {
		const tracking = trackIntervals();
		const { view, workout } = setup([exercise("A"), exercise("B")]);
		click(view["exerciseCards"][0]!.getRootEl(), ".ln-set-check");
		const firstRest = tracking.ids().at(-1)!;
		vi.advanceTimersByTime(3000);
		click(view["exerciseCards"][1]!.getRootEl(), ".ln-set-check");
		tracking.expectClearedOnce([firstRest]);
		vi.advanceTimersByTime(2000);
		view.resume({ workout, startTimeMs: Date.now() - 5000 });
		const rest = element(view.containerEl, ".ln-rest-timer");
		expect(rest.previousElementSibling).toBe(view["exerciseCards"][1]!.getRootEl());
		expect(rest.classList.contains("ln-rest-timer-hidden")).toBe(false);
		vi.advanceTimersByTime(1000);
		expect(element(rest, ".ln-rest-timer-value").textContent).toBe("0:03");
		expect(vi.getTimerCount()).toBe(2);
	});
});

describe("WorkoutView teardown", () => {
	function running() {
		const tracking = trackIntervals();
		const state = setup([exercise("Timer", "timer"), exercise("Hold", "duration"), exercise("Weight")]);
		click(state.root, ".ln-timer-block-start-btn");
		click(state.root, ".ln-duration-action");
		click(state.root, ".ln-set-check");
		expect(tracking.ids()).toHaveLength(4);
		return { ...state, tracking };
	}

	it("clears only the removed card's interval exactly once", async () => {
		const { view, tracking } = running();
		const ids = tracking.ids();
		const [timer, hold] = view["exerciseCards"];
		menuAction(timer!.getRootEl(), "Remove exercise");
		tracking.expectClearedOnce([ids[1]!]);
		expect(tracking.clear).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(3);
		menuAction(hold!.getRootEl(), "Remove exercise");
		tracking.expectClearedOnce([ids[1]!, ids[2]!]);
		expect(tracking.clear).toHaveBeenCalledTimes(2);
		await view.onClose();
		tracking.expectClearedOnce(ids);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(["startEmpty", "startFromTemplate", "resume"] as const)("%s tears down outgoing card intervals via renderWorkout", async (method) => {
		const { view, workout, tracking } = running();
		const ids = tracking.ids();
		const oldTimer = element(view.containerEl, ".ln-timer-block-countdown");
		const oldHold = element(view.containerEl, ".ln-duration-display");
		if (method === "startEmpty") view.startEmpty();
		else if (method === "startFromTemplate") view.startFromTemplate({ type: "workout-template", name: "New", exercises: [] });
		else view.resume({ workout, startTimeMs: Date.now() });
		tracking.expectClearedOnce(ids.slice(0, 3));
		expect(vi.getTimerCount()).toBe(method === "resume" ? 2 : 1);
		vi.advanceTimersByTime(3000);
		expect(oldTimer.textContent).toBe("10");
		expect(oldHold.textContent).toBe("0:00");
		await view.onClose();
		tracking.expectClearedOnce(tracking.ids());
		expect(vi.getTimerCount()).toBe(0);
	});

	it("onClose clears elapsed, rest, timer and hold intervals exactly once", async () => {
		const { view, tracking, workout } = running();
		await view.onClose();
		tracking.expectClearedOnce(tracking.ids());
		expect(vi.getTimerCount()).toBe(0);
		const snapshot = structuredClone(workout);
		vi.advanceTimersByTime(120000);
		expect(workout).toEqual(snapshot);
	});

	// src/views/workout-view.ts:326 registers a closure on every render,
	// and onClose (line 568) clears the same elapsed ID without nulling it.
	it.fails("clears every interval exactly once across rerenders, onClose and component unload", async () => {
		const { view, tracking, workout } = running();
		view.resume({ workout, startTimeMs: Date.now() });
		view.resume({ workout, startTimeMs: Date.now() });
		await view.onClose();
		view.unload();
		expect(vi.getTimerCount()).toBe(0);
		tracking.expectClearedOnce(tracking.ids());
	});
});
