import { afterEach, beforeEach, expect, vi } from "vitest";
import { installObsidianDom } from "../mocks/obsidian";
import type { Exercise, WorkoutSet } from "../../src/types";

installObsidianDom();

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
});

afterEach(() => {
	document.body.replaceChildren();
	vi.clearAllTimers();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

export function element<T extends HTMLElement = HTMLElement>(parent: ParentNode, selector: string): T {
	const el = parent.querySelector<T>(selector);
	expect(el, selector).not.toBeNull();
	return el!;
}

export function click(parent: ParentNode, selector: string): void {
	element(parent, selector).click();
}

export function input(parent: ParentNode, selector: string, value: string): void {
	const el = element<HTMLInputElement>(parent, selector);
	el.value = value;
	el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function menuAction(root: HTMLElement, title: string): void {
	click(root, ".ln-exercise-menu-btn");
	const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".menu button"))
		.find((el) => el.textContent === title);
	expect(button, title).toBeDefined();
	button!.click();
}

export function trackIntervals() {
	const start = vi.spyOn(window, "setInterval");
	const clear = vi.spyOn(window, "clearInterval");
	return {
		start,
		clear,
		ids: () => start.mock.results.map((result) => result.value as number),
		expectClearedOnce(ids: number[]) {
			for (const id of ids) {
				expect(clear.mock.calls.filter(([cleared]) => cleared === id), `interval ${id}`).toHaveLength(1);
			}
		},
	};
}

export function workoutSet(): WorkoutSet {
	return { weight: 0, reps: 0, unit: "kg", completed: false, durationSeconds: 0 };
}

export function exercise(name: string, exerciseType: Exercise["exerciseType"] = "weight"): Exercise {
	return exerciseType === "timer"
		? { name, exerciseType, sets: [], workSeconds: 40, restSeconds: 20, transitionSeconds: 0, intervals: 3 }
		: { name, exerciseType, sets: [workoutSet()] };
}
