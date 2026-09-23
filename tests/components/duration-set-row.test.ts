// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DurationSetRow } from "../../src/components/duration-set-row";
import { screenWakeLock } from "../../src/utils/wake-lock";
import { click, element, input, trackIntervals, workoutSet } from "../helpers/dom";

function callbacks() {
	return { onSetChanged: vi.fn(), onSetCompleted: vi.fn(), onSetRemoved: vi.fn() };
}

describe("DurationSetRow", () => {
	it("times a hold, completes it on stop, and resets without mutating the input set", () => {
		const tracking = trackIntervals();
		const set = workoutSet();
		const callbacks = { onSetChanged: vi.fn(), onSetCompleted: vi.fn(), onSetRemoved: vi.fn() };
		const row = new DurationSetRow(document.body, 1, set, { ...workoutSet(), durationSeconds: 45 }, callbacks);
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

	it("counts down the get-set buffer, then times the hold and subtracts the buffer on stop", () => {
		const tracking = trackIntervals();
		const acquire = vi.spyOn(screenWakeLock, "acquire");
		const release = vi.spyOn(screenWakeLock, "release");
		const cb = callbacks();
		const row = new DurationSetRow(document.body, 1, workoutSet(), null, cb, { bufferSeconds: 5 });
		const root = row.getRootEl();
		const display = () => element(root, ".ln-duration-display").textContent;
		const action = () => element(root, ".ln-duration-action").textContent;

		click(root, ".ln-duration-action");
		expect(display()).toBe("5");
		expect(element(root, ".ln-duration-countdown-label").textContent).toBe("Get set");
		expect(action()).toBe("Cancel");
		expect(root.classList.contains("ln-duration-counting")).toBe(true);
		expect(acquire).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(2000);
		expect(display()).toBe("3");

		vi.advanceTimersByTime(3000);
		expect(display()).toBe("0:00");
		expect(action()).toBe("Stop");
		expect(root.querySelector(".ln-duration-countdown-label")).toBeNull();
		expect(root.classList.contains("ln-duration-counting")).toBe(false);
		vi.advanceTimersByTime(20000);
		expect(display()).toBe("0:20"); // raw clock while running

		click(root, ".ln-duration-action");
		expect(cb.onSetCompleted).toHaveBeenCalledExactlyOnceWith({ ...workoutSet(), durationSeconds: 15, completed: true });
		expect(display()).toBe("0:15");
		expect(acquire).toHaveBeenCalledTimes(1);
		expect(release).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
		// One ticker spans count-down and hold
		expect(tracking.ids()).toHaveLength(1);
		row.destroy();
		expect(release).toHaveBeenCalledTimes(1);
		tracking.expectClearedOnce(tracking.ids());
	});

	it("cancels during the count-down without recording anything", () => {
		const tracking = trackIntervals();
		const release = vi.spyOn(screenWakeLock, "release");
		const cb = callbacks();
		const row = new DurationSetRow(document.body, 1, workoutSet(), null, cb, { bufferSeconds: 5 });
		const root = row.getRootEl();
		click(root, ".ln-duration-action");
		vi.advanceTimersByTime(2000);
		click(root, ".ln-duration-action");
		expect(element(root, ".ln-duration-action").textContent).toBe("Start");
		expect(element(root, ".ln-duration-display").textContent).toBe("0:00");
		expect(row.getSet()).toEqual(workoutSet());
		expect(cb.onSetChanged).not.toHaveBeenCalled();
		expect(cb.onSetCompleted).not.toHaveBeenCalled();
		expect(release).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
		vi.advanceTimersByTime(10000);
		expect(element(root, ".ln-duration-action").textContent).toBe("Start");
		tracking.expectClearedOnce(tracking.ids());
		row.destroy();
	});

	it("never records a negative hold when stopped inside the trailing buffer", () => {
		const cb = callbacks();
		const row = new DurationSetRow(document.body, 1, workoutSet(), null, cb, { bufferSeconds: 5 });
		click(row.getRootEl(), ".ln-duration-action");
		vi.advanceTimersByTime(5000 + 3000);
		click(row.getRootEl(), ".ln-duration-action");
		expect(cb.onSetCompleted).toHaveBeenCalledExactlyOnceWith({ ...workoutSet(), durationSeconds: 0, completed: true });
		row.destroy();
	});

	it("destroy during the count-down releases the wake lock and its interval once", () => {
		const tracking = trackIntervals();
		const release = vi.spyOn(screenWakeLock, "release");
		const row = new DurationSetRow(document.body, 1, workoutSet(), null, callbacks(), { bufferSeconds: 5 });
		click(row.getRootEl(), ".ln-duration-action");
		row.destroy();
		row.destroy();
		expect(release).toHaveBeenCalledTimes(1);
		expect(screenWakeLock.held).toBe(0);
		tracking.expectClearedOnce(tracking.ids());
	});

	it("records an optional added weight in the settings unit and shows weighted previous holds", () => {
		const cb = callbacks();
		const previous = { ...workoutSet(), durationSeconds: 60, weight: 20, unit: "kg" as const };
		const row = new DurationSetRow(document.body, 1, workoutSet(), previous, cb, { weightUnit: "lbs" });
		const root = row.getRootEl();
		expect(element(root, ".ln-duration-previous").textContent).toBe("prev 1:00 @ 20 kg");
		const weight = element<HTMLInputElement>(root, ".ln-duration-weight");
		expect(weight.value).toBe("");
		expect(weight.placeholder).toBe("lbs");
		input(root, ".ln-duration-weight", "22,5");
		expect(cb.onSetChanged).toHaveBeenLastCalledWith({ ...workoutSet(), weight: 22.5, unit: "lbs" });
		click(root, ".ln-duration-action");
		vi.advanceTimersByTime(30000);
		click(root, ".ln-duration-action");
		expect(cb.onSetCompleted).toHaveBeenCalledExactlyOnceWith(
			{ ...workoutSet(), weight: 22.5, unit: "lbs", durationSeconds: 30, completed: true });
		// Re-render keeps the typed weight
		expect(element<HTMLInputElement>(root, ".ln-duration-weight").value).toBe("22.5");
		row.destroy();
	});
});
