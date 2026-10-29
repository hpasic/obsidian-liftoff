// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceLeaf } from "obsidian";
import type LiftOffPlugin from "../../src/main";
import { WorkoutView } from "../../src/views/workout-view";
import { DEFAULT_SETTINGS, type ActiveWorkout, type Exercise, type Workout } from "../../src/types";
import { DurationSetRow } from "../../src/components/duration-set-row";
import { screenWakeLock } from "../../src/utils/wake-lock";
import { workoutToFullMarkdown } from "../../src/utils/frontmatter";
import { click, element, exercise, input, menuAction, trackIntervals } from "../helpers/dom";

const views: WorkoutView[] = [];
afterEach(async () => {
	for (const view of views.splice(0)) await view.onClose();
});

function setup(exercises: Exercise[] = [], history: Workout[] = [], startedTimerIndices?: number[]) {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, holdBufferSeconds: 0, exerciseLibrary: [] },
		workoutStore: {
			getRecentWorkouts: vi.fn(() => history.map((_, i) => ({ path: String(i) }))),
			parseWorkoutFile: vi.fn((path: string) => history[Number(path)] ?? null),
			saveWorkout: vi.fn().mockResolvedValue(undefined),
		},
		persistActiveWorkout: vi.fn().mockResolvedValue(undefined),
		clearActiveWorkout: vi.fn().mockResolvedValue(undefined),
		showHomeView: vi.fn().mockResolvedValue(undefined),
		saveSettings: vi.fn().mockResolvedValue(undefined),
	};
	const workout: Workout = {
		type: "workout", template: null, date: "2026-09-21", start: "12:00",
		end: null, duration: null, exercises,
	};
	const view = new WorkoutView({ app: {} } as unknown as WorkspaceLeaf, plugin as unknown as LiftOffPlugin);
	document.body.appendChild(view.containerEl);
	view.resume({ workout, startTimeMs: Date.now(), startedTimerIndices });
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
			.toEqual(["Move up", "Change type\u2026", "Remove exercise"]);
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

async function changeType(card: HTMLElement, type: "weight" | "timer" | "duration") {
	menuAction(card, "Change type…");
	click(document, `.modal .ln-type-choice-btn[data-type="${type}"]`);
	for (let i = 0; i < 3; i++) await Promise.resolve();
}

describe("WorkoutView change type", () => {
	it("swaps a card with no completed sets to the timer block in place and updates the library", async () => {
		const { view, workout, plugin } = setup([exercise("A"), exercise("Plank")]);
		const card = view["exerciseCards"][1]!;
		const root = card.getRootEl();
		const live = card.getExercise();
		await changeType(root, "timer");
		expect(document.querySelector(".modal")).toBeNull(); // No confirm without completed sets
		expect(view["exerciseCards"][1]).toBe(card);
		expect(card.getRootEl()).toBe(root);
		expect(card.getExercise()).toBe(live);
		expect(workout.exercises[1]).toBe(live);
		expect(live).toMatchObject({ exerciseType: "timer", sets: [], workSeconds: 40, intervals: 5 });
		expect(card["timerBlock"]).not.toBeNull();
		expect(root.querySelector(".ln-set-row:not(.ln-set-header)")).toBeNull();
		expect(plugin.settings.exerciseLibrary).toEqual([{ name: "Plank", exerciseType: "timer" }]);
		expect(plugin.saveSettings).toHaveBeenCalled();
		expect(plugin.persistActiveWorkout).toHaveBeenCalled();
	});

	it("confirms before dropping completed sets, and keeps them on cancel", async () => {
		const plank = exercise("Plank");
		plank.sets = [
			{ weight: 10, reps: 5, unit: "kg", completed: false },
			{ weight: 10, reps: 5, unit: "kg", completed: false },
		];
		const { view, plugin } = setup([plank]);
		const card = view["exerciseCards"][0]!;
		click(card.getRootEl(), ".ln-set-check");

		await changeType(card.getRootEl(), "duration");
		expect(element(document, ".modal .ln-modal-message").textContent)
			.toBe("Change \"Plank\" to duration? Its 1 completed set will be discarded.");
		click(document, ".modal button:not(.mod-cta)");
		await Promise.resolve();
		expect(plank.exerciseType).toBe("weight");
		expect(plank.sets.filter((s) => s.completed)).toHaveLength(1);
		expect(plugin.settings.exerciseLibrary).toEqual([]);

		await changeType(card.getRootEl(), "duration");
		click(document, ".modal .mod-cta");
		await Promise.resolve();
		expect(plank.exerciseType).toBe("duration");
		expect(plank.sets).toEqual([{ weight: 10, reps: 0, unit: "kg", completed: false, durationSeconds: 0 }]);
		expect(card["setRows"][0]).toBeInstanceOf(DurationSetRow);
		expect(plugin.settings.exerciseLibrary).toEqual([{ name: "Plank", exerciseType: "duration" }]);
	});

	it("leaves other cards' running timer, hold and the rest timer untouched", async () => {
		const tracking = trackIntervals();
		const { view, workout } = setup([exercise("Timer", "timer"), exercise("Hold", "duration"), exercise("Other"), exercise("Rest")]);
		const [timerCard, holdCard, other, restOwner] = view["exerciseCards"];
		const timer = timerCard!["timerBlock"]!;
		const hold = holdCard!["setRows"][0] as DurationSetRow;
		click(timerCard!.getRootEl(), ".ln-timer-block-start-btn");
		click(hold.getRootEl(), ".ln-duration-action");
		click(restOwner!.getRootEl(), ".ln-set-check");
		vi.advanceTimersByTime(2000);
		const ids = tracking.ids();

		await changeType(other!.getRootEl(), "duration");
		expectParallel(view, workout, ["Timer", "Hold", "Other", "Rest"]);
		expect(other!.getExercise().exerciseType).toBe("duration");
		expect(timerCard!["timerBlock"]).toBe(timer);
		expect(holdCard!["setRows"][0]).toBe(hold);
		expect(tracking.ids()).toEqual(ids);
		expect(tracking.clear).not.toHaveBeenCalled();
		const rest = element(view.containerEl, ".ln-rest-timer");
		expect(rest.previousElementSibling).toBe(restOwner!.getRootEl());
		vi.advanceTimersByTime(2000);
		expect(element(timerCard!.getRootEl(), ".ln-timer-block-countdown").textContent).toBe("6");
		expect(element(hold.getRootEl(), ".ln-duration-display").textContent).toBe("0:04");
		expect(element(rest, ".ln-rest-timer-value").textContent).toBe("0:04");
	});

	it("confirms before stopping its own running timer, and tears down only that interval", async () => {
		const tracking = trackIntervals();
		const { view } = setup([exercise("Tabata", "timer")]);
		const card = view["exerciseCards"][0]!;
		click(card.getRootEl(), ".ln-timer-block-start-btn");
		const timerId = tracking.ids().at(-1)!;
		vi.advanceTimersByTime(15_000); // Past the count-in: a real run
		await changeType(card.getRootEl(), "weight");
		expect(element(document, ".modal .ln-modal-message").textContent)
			.toBe("Change \"Tabata\" to weight? Its running timer will be stopped.");
		click(document, ".modal .mod-cta");
		await Promise.resolve();
		expect(card.getExercise()).toEqual({ name: "Tabata", exerciseType: "weight", sets: [{ weight: 0, reps: 0, unit: "kg", completed: false }] });
		tracking.expectClearedOnce([timerId]);
		expect(vi.getTimerCount()).toBe(1); // Workout elapsed timer remains
	});

	it("does nothing when the current type is picked", async () => {
		const { view, plugin } = setup([exercise("A")]);
		const card = view["exerciseCards"][0]!;
		const rows = card["setRows"];
		await changeType(card.getRootEl(), "weight");
		expect(card["setRows"]).toBe(rows);
		expect(plugin.saveSettings).not.toHaveBeenCalled();
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
		expect(screenWakeLock.held).toBe(1); // A running rest timer keeps the screen on
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
		expect(screenWakeLock.held).toBe(0);
		click(b!.getRootEl(), ".ln-set-check"); // Callback uses its new index.
		expect(rest.previousElementSibling).toBe(b!.getRootEl());
		click(b!.getRootEl(), ".ln-set-check");
		click(b!.getRootEl(), ".ln-set-check"); // A restart still holds only once
		expect(screenWakeLock.held).toBe(1);
		click(rest, ".ln-rest-timer-dismiss");
		expect(screenWakeLock.held).toBe(0);
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

	it("lets the screen sleep after 10 minutes of rest while the rest timer keeps counting", () => {
		const { view } = setup([exercise("A")]);
		click(view["exerciseCards"][0]!.getRootEl(), ".ln-set-check");
		vi.advanceTimersByTime(599_000);
		expect(screenWakeLock.held).toBe(1);
		vi.advanceTimersByTime(1000);
		expect(screenWakeLock.held).toBe(0);
		vi.advanceTimersByTime(5000);
		expect(element(view.containerEl, ".ln-rest-timer-value").textContent).toBe("10:05");
		click(view.containerEl, ".ln-rest-timer-dismiss");
		expect(screenWakeLock.held).toBe(0);
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

	it("clears every interval exactly once across rerenders, onClose and component unload", async () => {
		const { view, tracking, workout } = running();
		view.resume({ workout, startTimeMs: Date.now() });
		view.resume({ workout, startTimeMs: Date.now() });
		await view.onClose();
		view.unload();
		expect(vi.getTimerCount()).toBe(0);
		tracking.expectClearedOnce(tracking.ids());
	});
});

async function finish(root: HTMLElement) {
	click(root, ".ln-finish-btn");
	click(document, ".modal .mod-cta");
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("WorkoutView finish", () => {
	it("saves summary volume in the settings unit when rows use another unit", async () => {
		const bench = exercise("Bench");
		bench.sets = [{ weight: 50, reps: 5, unit: "kg", completed: false }];
		const { root, plugin } = setup([bench]);
		plugin.settings.weightUnit = "lbs";
		click(root, ".ln-set-check");
		await finish(root);
		const summary = plugin.workoutStore.saveWorkout.mock.calls[0]![1] as string;
		expect(summary).toContain("- **Total volume**: 551.2 lbs");
	});

	it.each([false, true])("does not save a timer finished during count-in without a note (paused: %s)", async (paused) => {
		const { root, plugin } = setup([exercise("Tabata", "timer")]);
		click(root, ".ln-timer-block-start-btn");
		if (paused) click(root, ".ln-timer-block-control-btn");
		await finish(root);
		expect(plugin.workoutStore.saveWorkout).not.toHaveBeenCalled();
		expect(plugin.clearActiveWorkout).not.toHaveBeenCalled();
	});

	it.each([
		[0, false], [0, true], [9_999, false], [9_999, true],
	] as const)("saves count-in as not started after %i ms (paused: %s)", async (elapsed, paused) => {
		const timer = { ...exercise("Tabata", "timer"), transitionSeconds: 5 };
		const { root, plugin } = setup([timer]);
		click(root, ".ln-timer-block-start-btn");
		vi.advanceTimersByTime(elapsed);
		input(root, ".ln-exercise-note-input", "ran out of time");
		expect(plugin.persistActiveWorkout).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), []);
		if (paused) click(root, ".ln-timer-block-control-btn");
		await finish(root);
		expect(plugin.workoutStore.saveWorkout).toHaveBeenCalledTimes(1);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises).toEqual([{ name: "Tabata", exerciseType: "timer", sets: [], note: "ran out of time" }]);
		const markdown = workoutToFullMarkdown(saved);
		expect(markdown).toContain("_Not started._");
		expect(markdown).not.toContain("Timer stopped early.");
		expect(markdown).not.toContain("Intervals:");
		expect(timer.workSeconds).toBe(40); // Saving leaves the live config untouched
	});

	it.each([
		[false, "feeling tired"],
		[true, undefined],
	] as const)("keeps config and marks a started timer stopped early (paused: %s)", async (paused, note) => {
		const timer = { ...exercise("Tabata", "timer"), transitionSeconds: 5 };
		const { root, plugin } = setup([timer]);
		click(root, ".ln-timer-block-start-btn");
		vi.advanceTimersByTime(10_000); // First work interval has just begun
		expect(plugin.persistActiveWorkout).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), [0]);
		if (note) input(root, ".ln-exercise-note-input", note);
		if (paused) click(root, ".ln-timer-block-control-btn");
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		const expectedNote = note ? `${note}\nTimer stopped early.` : "Timer stopped early.";
		expect(saved.exercises).toEqual([{ ...timer, sets: [], note: expectedNote }]);
		const markdown = workoutToFullMarkdown(saved);
		expect(markdown).toContain("> Timer stopped early.");
		expect(markdown).toContain("Intervals: 3 × 0:40 work / 0:20 rest / 0:05 switch");
		expect(markdown).not.toContain("_Not started._");
		expect(timer.note).toBe(note); // Save leaves the live note untouched
	});

	it.each([false, true])("finishes a restored started timer without restarting its work interval (count-in: %s)", async (countIn) => {
		const timer = { ...exercise("Tabata", "timer"), note: "feeling tired" };
		const { root, plugin } = setup([timer, exercise("Tabata", "timer")], [], [0]);
		expect(root.querySelector(".ln-timer-block-countdown")).toBeNull();
		if (countIn) click(root, ".ln-timer-block-start-btn");
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises).toEqual([{ ...timer, note: "feeling tired\nTimer stopped early." }]);
		expect(saved).not.toHaveProperty("startedTimerIndices");
		expect(saved.exercises[0]).not.toHaveProperty("startedTimerIndices");
		const markdown = workoutToFullMarkdown(saved);
		expect(markdown).toContain("Intervals: 3 × 0:40 work / 0:20 rest");
		expect(markdown).toContain("> Timer stopped early.");
		expect(markdown).not.toContain("startedTimerIndices");
	});

	it("persists the first work interval immediately and finishes after a JSON round-trip and resume", async () => {
		const { view, root, plugin } = setup([exercise("Tabata", "timer")]);
		click(root, ".ln-timer-block-start-btn");
		expect(plugin.persistActiveWorkout).not.toHaveBeenCalled();
		vi.advanceTimersByTime(10_000);
		const [workout, startTimeMs, startedTimerIndices] = plugin.persistActiveWorkout.mock.lastCall!;
		const restored = JSON.parse(JSON.stringify({ workout, startTimeMs, startedTimerIndices })) as ActiveWorkout;
		expect(restored.startedTimerIndices).toEqual([0]);
		view.resume(restored);
		expect(root.querySelector(".ln-timer-block-countdown")).toBeNull();
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises).toEqual([{ ...restored.workout.exercises[0], note: "Timer stopped early." }]);
	});

	it("keeps started markers attached to duplicate-name exercises through moves and removals", async () => {
		const { view, root, plugin } = setup([exercise("Same", "timer"), exercise("Same", "timer"), exercise("Other")]);
		const [neverStarted, started, other] = view["exerciseCards"];
		click(started!.getRootEl(), ".ln-timer-block-start-btn");
		vi.advanceTimersByTime(10_000);
		expect(plugin.persistActiveWorkout.mock.lastCall?.[2]).toEqual([1]);
		menuAction(started!.getRootEl(), "Move up");
		expect(plugin.persistActiveWorkout.mock.lastCall?.[2]).toEqual([0]);
		menuAction(other!.getRootEl(), "Remove exercise");
		expect(plugin.persistActiveWorkout.mock.lastCall?.[2]).toEqual([0]);
		menuAction(started!.getRootEl(), "Move down");
		menuAction(neverStarted!.getRootEl(), "Remove exercise");
		expect(plugin.persistActiveWorkout.mock.lastCall?.[2]).toEqual([0]);
		const [workout, startTimeMs, startedTimerIndices] = plugin.persistActiveWorkout.mock.lastCall!;
		view.resume(JSON.parse(JSON.stringify({ workout, startTimeMs, startedTimerIndices })) as ActiveWorkout);
		await finish(root);
		expect((plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout).exercises[0]?.note).toBe("Timer stopped early.");
	});

	it("clears the started marker when a completed timer is reset", async () => {
		const timer = { ...exercise("Tabata", "timer"), workSeconds: 1, intervals: 1, note: "try again later" };
		const { root, plugin } = setup([timer]);
		click(root, ".ln-timer-block-start-btn");
		vi.advanceTimersByTime(11_000);
		expect(plugin.persistActiveWorkout.mock.lastCall?.[2]).toEqual([0]);
		click(root, ".ln-timer-block-reset-btn");
		expect(plugin.persistActiveWorkout.mock.lastCall?.[2]).toEqual([]);
		click(root, ".ln-timer-block-start-btn");
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises).toEqual([{ name: "Tabata", exerciseType: "timer", sets: [], note: timer.note }]);
		expect(workoutToFullMarkdown(saved)).toContain("_Not started._");
	});

	it("keeps an exercise with a note even when none of its sets was completed", async () => {
		const skipped = { ...exercise("Bench"), note: "skipped, shoulder pain" };
		const done = exercise("Row");
		const untouched = exercise("Curl");
		const blankNote = { ...exercise("Dips"), note: "  \n" };
		const { root, plugin } = setup([skipped, done, untouched, blankNote]);
		click(root.querySelectorAll(".ln-exercise-card")[1]!, ".ln-set-check");
		await finish(root);
		expect(plugin.workoutStore.saveWorkout).toHaveBeenCalledTimes(1);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises.map((e) => [e.name, e.sets.length, e.note])).toEqual([
			["Bench", 0, "skipped, shoulder pain"],
			["Row", 1, undefined],
		]);
		expect(plugin.clearActiveWorkout).toHaveBeenCalledTimes(1);
		// Saving copies — the live exercise still has its unfinished set
		expect(skipped.sets).toHaveLength(1);
	});

	it("saves a workout that only has notes", async () => {
		const { root, plugin } = setup([{ ...exercise("Bench"), note: "outlier: sick" }]);
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises).toEqual([expect.objectContaining({ name: "Bench", sets: [], note: "outlier: sick" })]);
	});

	it("still refuses to save with neither a completed set nor a note", async () => {
		const { root, plugin } = setup([exercise("Bench"), { ...exercise("Row"), note: " " }]);
		await finish(root);
		expect(plugin.workoutStore.saveWorkout).not.toHaveBeenCalled();
		expect(plugin.clearActiveWorkout).not.toHaveBeenCalled();
	});

	it("saves a never-run timer with its note but without its config", async () => {
		const timer = { ...exercise("Tabata", "timer"), note: "ran out of time" };
		const { root, plugin } = setup([timer]);
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises).toEqual([{ name: "Tabata", exerciseType: "timer", sets: [], note: "ran out of time" }]);
		// The live exercise keeps its config
		expect(timer.workSeconds).toBe(40);
	});
});

describe("WorkoutView history auto-fill", () => {
	it.each(["template", "added"] as const)("creates zero-weight history sets in the settings unit (%s)", async (source) => {
		const history: Workout[] = [{
			type: "workout", template: null, date: "2026-09-20", start: "18:00", end: "18:30", duration: 30,
			exercises: [{ name: "Dips", sets: [{ weight: 0, reps: 5, unit: "kg", completed: true }] }],
		}];
		const { view, root, plugin } = setup([], history);
		plugin.settings.weightUnit = "lbs";
		if (source === "template") {
			view.startFromTemplate({
				type: "workout-template", name: "Push", exercises: [{ name: "Dips", targetSets: 2 }],
			});
		} else {
			add(root, "Dips");
		}
		expect(view["exerciseCards"][0]!.getExercise().sets.every((set) => set.unit === "lbs")).toBe(true);
		expect(element(root, ".ln-set-weight-unit").textContent).toBe("lbs");
		input(root, ".ln-weight-input", "10");
		click(root, ".ln-set-check");
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises[0]!.sets).toEqual([{ weight: 10, reps: 5, unit: "lbs", completed: true }]);
		expect(history[0]!.exercises[0]!.sets[0]!.unit).toBe("kg");
	});

	it("saves a carried-over kg set in kg after clearing its weight and removing the other set", async () => {
		const history: Workout[] = [{
			type: "workout", template: null, date: "2026-09-20", start: "18:00", end: "18:30", duration: 30,
			exercises: [{ name: "Bench", sets: [
				{ weight: 80, reps: 5, unit: "kg", completed: true },
				{ weight: 80, reps: 5, unit: "kg", completed: true },
			] }],
		}];
		const { view, root, plugin } = setup([], history);
		plugin.settings.weightUnit = "lbs";
		view.startFromTemplate({
			type: "workout-template", name: "Push", exercises: [{ name: "Bench", targetSets: 2 }],
		});
		expect(Array.from(root.querySelectorAll(".ln-set-weight-unit"), (el) => el.textContent)).toEqual(["kg", "kg"]);
		input(root, ".ln-weight-input", "");
		const rows = root.querySelectorAll(".ln-sets-container .ln-set-row");
		click(rows[1]!, ".ln-set-remove");
		input(root, ".ln-weight-input", "82.5");
		click(root, ".ln-set-check");
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises[0]!.sets).toEqual([{ weight: 82.5, reps: 5, unit: "kg", completed: true }]);
		expect(element(root, ".ln-set-weight-unit").textContent).toBe("kg");
		expect(element(root, ".ln-weight-input").getAttribute("aria-label")).toBe("Weight (kg)");
	});

	it("saves a toggled unit with the typed weight and auto-fills it next time", async () => {
		const history: Workout[] = [{
			type: "workout", template: null, date: "2026-09-20", start: "18:00", end: "18:30", duration: 30,
			exercises: [{ name: "Bench", sets: [{ weight: 225, reps: 5, unit: "kg", completed: true }] }],
		}];
		const { view, root, plugin } = setup([], history);
		add(root, "Bench");
		click(root, ".ln-set-weight-unit");
		expect(element(root, ".ln-set-weight-unit").textContent).toBe("lbs");
		expect(element<HTMLInputElement>(root, ".ln-weight-input").value).toBe("225");
		click(root, ".ln-set-check");
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises[0]!.sets).toEqual([{ weight: 225, reps: 5, unit: "lbs", completed: true }]);

		history.unshift({ ...saved, date: "2026-09-21" });
		view.startFromTemplate({
			type: "workout-template", name: "Push", exercises: [{ name: "Bench", targetSets: 1 }],
		});
		expect(view["exerciseCards"][0]!.getExercise().sets[0]).toMatchObject({ weight: 225, unit: "lbs" });
		expect(element(root, ".ln-set-weight-unit").textContent).toBe("lbs");
	});

	it.each(["template", "added"] as const)("keeps kg weights displayed, edited and copied in kg with lbs settings (%s)", async (source) => {
		const weightHistory: Workout[] = [{
			type: "workout", template: null, date: "2026-09-20", start: "18:00", end: "18:30", duration: 30,
			exercises: [{ name: "Bench", sets: [{ weight: 80, reps: 5, unit: "kg", completed: true }] }],
		}];
		const { view, root, plugin } = setup([], weightHistory);
		plugin.settings.weightUnit = "lbs";
		if (source === "template") {
			view.startFromTemplate({
				type: "workout-template", name: "Push", exercises: [{ name: "Bench", targetSets: 1 }],
			});
		} else {
			add(root, "Bench");
		}
		expect(element(root, ".ln-set-weight-unit").textContent).toBe("kg");
		expect(element(root, ".ln-weight-input").getAttribute("aria-label")).toBe("Weight (kg)");
		expect(element<HTMLInputElement>(root, ".ln-weight-input").value).toBe("80");
		input(root, ".ln-weight-input", "82.5");
		click(root, ".ln-set-check");
		click(root, ".ln-add-set-btn");
		const rows = root.querySelectorAll(".ln-sets-container .ln-set-row");
		expect(element(rows[1]!, ".ln-set-weight-unit").textContent).toBe("kg");
		expect(element<HTMLInputElement>(rows[1]!, ".ln-weight-input").value).toBe("82.5");
		input(rows[1]!, ".ln-reps-input", "4");
		click(rows[1]!, ".ln-set-check");
		await finish(root);
		const saved = plugin.workoutStore.saveWorkout.mock.calls[0]![0] as Workout;
		expect(saved.exercises[0]!.sets.map((s) => [s.weight, s.unit])).toEqual([[82.5, "kg"], [82.5, "kg"]]);
	});

	const history: Workout[] = [{
		type: "workout", template: "Grip", date: "2026-09-20", start: "18:00", end: "18:30", duration: 30,
		exercises: [{
			name: "Farmer's Hold",
			exerciseType: "duration",
			sets: [
				{ weight: 24, reps: 0, unit: "kg", completed: true, durationSeconds: 60 },
				{ weight: 0, reps: 0, unit: "kg", completed: true, durationSeconds: 40 },
			],
		}],
	}];

	it("carries hold weight forward from a template start", () => {
		const { view } = setup([], history);
		view.startFromTemplate({
			type: "workout-template", name: "Grip",
			exercises: [{ name: "Farmer's Hold", targetSets: 2, exerciseType: "duration" }],
		});
		const card = view["exerciseCards"][0]!;
		expect(card.getExercise().sets.map((s) => [s.weight, s.durationSeconds, s.completed])).toEqual([[24, 0, false], [0, 0, false]]);
		const weights = Array.from(card.getRootEl().querySelectorAll<HTMLInputElement>(".ln-duration-weight"), (el) => el.value);
		expect(weights).toEqual(["24", ""]);
		expect(element(card.getRootEl(), ".ln-duration-previous").textContent).toBe("prev 1:00 @ 24 kg");
	});

	it("carries hold weight forward when the exercise is added mid-workout", () => {
		const { view, root } = setup([], history);
		add(root, "Farmer's Hold", "duration");
		expect(view["exerciseCards"][0]!.getExercise().sets.map((s) => [s.weight, s.unit, s.durationSeconds]))
			.toEqual([[24, "kg", 0], [0, "kg", 0]]);
	});

	it("is not hidden by a newer note-only session", () => {
		const skipped: Workout = {
			...history[0]!, date: "2026-09-22",
			exercises: [{ name: "Farmer's Hold", exerciseType: "duration", note: "skipped, grip sore", sets: [] }],
		};
		const { view } = setup([], [skipped, ...history]);
		view.startFromTemplate({
			type: "workout-template", name: "Grip",
			exercises: [{ name: "Farmer's Hold", targetSets: 2, exerciseType: "duration" }],
		});
		const card = view["exerciseCards"][0]!;
		expect(card.getExercise().sets.map((s) => s.weight)).toEqual([24, 0]);
		expect(element(card.getRootEl(), ".ln-duration-previous").textContent).toBe("prev 1:00 @ 24 kg");
		expect(element(card.getRootEl(), ".ln-exercise-previous-note").textContent)
			.toBe("Last note (2026-09-22): skipped, grip sore");
	});
});
