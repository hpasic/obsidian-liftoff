// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { TimerBlock } from "../../src/components/timer-block";
import { click, element, input, trackIntervals } from "../helpers/dom";

function setup(initialCompleted = false) {
	const root = document.body.createDiv();
	const callbacks = { onCompleted: vi.fn(), onChanged: vi.fn(), onReset: vi.fn() };
	const timer = new TimerBlock(root, 2, 3, 1, 3, callbacks, initialCompleted);
	return { root, callbacks, timer };
}

describe("TimerBlock", () => {
	it("runs count-in, work, switch and rest phases without trailing rest or leaked intervals", () => {
		const tracking = trackIntervals();
		const { root, callbacks, timer } = setup();
		const phase = () => element(root, ".ln-timer-block-phase-label").textContent;
		click(root, ".ln-timer-block-start-btn");
		expect(phase()).toBe("GET READY");
		vi.advanceTimersByTime(10000);
		expect(phase()).toBe("WORK");
		expect(element(root, ".ln-timer-block-interval-label").textContent).toBe("Interval 1/3");
		vi.advanceTimersByTime(2000);
		expect(phase()).toBe("SWITCH SIDES");
		vi.advanceTimersByTime(1000);
		expect(phase()).toBe("WORK");
		expect(element(root, ".ln-timer-block-interval-label").textContent).toBe("Interval 2/3");
		vi.advanceTimersByTime(2000);
		expect(phase()).toBe("REST");
		vi.advanceTimersByTime(3000);
		expect(phase()).toBe("WORK");
		expect(element(root, ".ln-timer-block-interval-label").textContent).toBe("Interval 3/3");
		vi.advanceTimersByTime(2000);
		expect(timer.getState().completed).toBe(true);
		expect(callbacks.onCompleted).toHaveBeenCalledTimes(1);
		expect(element(root, ".ln-timer-block-done-label").textContent).toContain("3 intervals completed");
		expect(vi.getTimerCount()).toBe(0);
		expect(tracking.ids()).toHaveLength(6);
		timer.destroy();
		timer.destroy();
		tracking.expectClearedOnce(tracking.ids());
	});

	it("pauses and resumes the same countdown, then destroys the active interval once", () => {
		const tracking = trackIntervals();
		const { root, timer, callbacks } = setup();
		click(root, ".ln-timer-block-start-btn");
		vi.advanceTimersByTime(3000);
		click(root, ".ln-timer-block-control-btn");
		vi.advanceTimersByTime(20000);
		expect(element(root, ".ln-timer-block-countdown").textContent).toBe("7");
		expect(vi.getTimerCount()).toBe(0);
		click(root, ".ln-timer-block-control-btn");
		vi.advanceTimersByTime(2000);
		expect(element(root, ".ln-timer-block-countdown").textContent).toBe("5");
		timer.destroy();
		timer.destroy();
		vi.advanceTimersByTime(60000);
		expect(callbacks.onCompleted).not.toHaveBeenCalled();
		expect(root.children).toHaveLength(0);
		expect(vi.getTimerCount()).toBe(0);
		tracking.expectClearedOnce(tracking.ids());
	});

	it("restores completed state and resets to editable inputs without starting an interval", () => {
		const { root, timer, callbacks } = setup(true);
		expect(timer.getState().completed).toBe(true);
		expect(callbacks.onCompleted).not.toHaveBeenCalled();
		click(root, ".ln-timer-block-reset-btn");
		expect(callbacks.onReset).toHaveBeenCalledTimes(1);
		input(root, ".ln-timer-block-input", "12");
		expect(callbacks.onChanged).toHaveBeenLastCalledWith(12, 3, 1, 3);
		expect(timer.getState()).toEqual({ workSeconds: 12, restSeconds: 3, transitionSeconds: 1, intervals: 3, completed: false });
		expect(vi.getTimerCount()).toBe(0);
		timer.destroy();
	});
});
