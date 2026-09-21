// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DurationSetRow } from "../../src/components/duration-set-row";
import { click, element, trackIntervals, workoutSet } from "../helpers/dom";

describe("DurationSetRow", () => {
	it("times a hold, completes it on stop, and resets without mutating the input set", () => {
		const tracking = trackIntervals();
		const set = workoutSet();
		const callbacks = { onSetChanged: vi.fn(), onSetCompleted: vi.fn(), onSetRemoved: vi.fn() };
		const row = new DurationSetRow(document.body, 1, set, 45, callbacks);
		const root = row.getRootEl();
		expect(element(root, ".ln-duration-previous").textContent).toBe("prev 0:45");
		click(root, ".ln-duration-action");
		vi.advanceTimersByTime(3250);
		expect(element(root, ".ln-duration-display").textContent).toBe("0:03");
		expect(callbacks.onSetCompleted).not.toHaveBeenCalled();
		click(root, ".ln-duration-action");
		expect(callbacks.onSetCompleted).toHaveBeenCalledExactlyOnceWith({ ...set, durationSeconds: 3, completed: true });
		expect(row.getSet()).toEqual({ ...set, durationSeconds: 3, completed: true });
		expect(set).toEqual(workoutSet());
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(5000);
		expect(element(root, ".ln-duration-display").textContent).toBe("0:03");
		click(root, ".ln-duration-action");
		expect(callbacks.onSetChanged).toHaveBeenCalledExactlyOnceWith(set);
		expect(row.getSet()).toEqual(set);
		row.destroy();
		row.destroy();
		tracking.expectClearedOnce(tracking.ids());
	});

	it("destroy stops a running hold exactly once without completing it", () => {
		const tracking = trackIntervals();
		const callbacks = { onSetChanged: vi.fn(), onSetCompleted: vi.fn(), onSetRemoved: vi.fn() };
		const row = new DurationSetRow(document.body, 1, workoutSet(), null, callbacks);
		click(row.getRootEl(), ".ln-duration-action");
		vi.advanceTimersByTime(1000);
		const display = element(row.getRootEl(), ".ln-duration-display");
		row.destroy();
		row.destroy();
		vi.advanceTimersByTime(5000);
		expect(display.textContent).toBe("0:01");
		expect(row.getRootEl().isConnected).toBe(false);
		expect(callbacks.onSetCompleted).not.toHaveBeenCalled();
		expect(callbacks.onSetChanged).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		tracking.expectClearedOnce(tracking.ids());
	});

	it.each([true, false])("restores a saved hold (completed=%s) without starting a ticker", (completed) => {
		const row = new DurationSetRow(document.body, 1, { ...workoutSet(), completed, durationSeconds: 65 }, null,
			{ onSetChanged: vi.fn(), onSetCompleted: vi.fn(), onSetRemoved: vi.fn() });
		expect(element(row.getRootEl(), ".ln-duration-display").textContent).toBe("1:05");
		expect(element(row.getRootEl(), ".ln-duration-action").getAttribute("aria-label")).toBe("Reset timer");
		expect(vi.getTimerCount()).toBe(0);
		row.destroy();
	});
});
