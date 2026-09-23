// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WakeLockClaim, WakeLockManager } from "../../src/utils/wake-lock";

class FakeSentinel extends EventTarget {
	released = false;
	release = vi.fn(() => {
		this.released = true;
		this.dispatchEvent(new Event("release"));
		return Promise.resolve();
	});
}

let sentinels: FakeSentinel[];
let request: ReturnType<typeof vi.fn>;
let visibility: DocumentVisibilityState;

function installWakeLock(): void {
	request = vi.fn(() => {
		const sentinel = new FakeSentinel();
		sentinels.push(sentinel);
		return Promise.resolve(sentinel);
	});
	Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
}

function setVisibility(state: DocumentVisibilityState): void {
	visibility = state;
	document.dispatchEvent(new Event("visibilitychange"));
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const active = () => sentinels.filter((s) => !s.released);

beforeEach(() => {
	sentinels = [];
	visibility = "visible";
	vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
	installWakeLock();
});

afterEach(() => {
	vi.restoreAllMocks();
	Reflect.deleteProperty(navigator, "wakeLock");
});

describe("WakeLockManager", () => {
	it("requests one lock for overlapping holders and releases it after the last one", async () => {
		const manager = new WakeLockManager();
		manager.acquire();
		manager.acquire();
		await flush();
		expect(request).toHaveBeenCalledExactlyOnceWith("screen");
		expect(active()).toHaveLength(1);

		manager.release();
		await flush();
		expect(active()).toHaveLength(1);

		manager.release();
		manager.release(); // extra release is ignored, count never goes negative
		await flush();
		expect(active()).toHaveLength(0);
		expect(manager.held).toBe(0);

		manager.acquire();
		await flush();
		expect(request).toHaveBeenCalledTimes(2);
		expect(active()).toHaveLength(1);
		manager.reset();
		await flush();
		expect(active()).toHaveLength(0);
	});

	it("re-requests the lock when the page becomes visible again while held", async () => {
		const manager = new WakeLockManager();
		manager.acquire();
		await flush();
		// The browser drops the lock when the page is hidden
		visibility = "hidden";
		sentinels[0]!.release();
		setVisibility("hidden");
		await flush();
		expect(request).toHaveBeenCalledTimes(1);

		setVisibility("visible");
		await flush();
		expect(request).toHaveBeenCalledTimes(2);
		expect(active()).toHaveLength(1);

		manager.release();
		await flush();
		setVisibility("hidden");
		setVisibility("visible");
		await flush();
		expect(request).toHaveBeenCalledTimes(2);
		expect(active()).toHaveLength(0);
	});

	it("releases a lock that resolves after the last holder is gone", async () => {
		const manager = new WakeLockManager();
		manager.acquire();
		manager.release();
		await flush();
		expect(request).toHaveBeenCalledTimes(1);
		expect(active()).toHaveLength(0);
	});

	it("is a silent no-op when the API is missing or the request is denied", async () => {
		Reflect.deleteProperty(navigator, "wakeLock");
		const manager = new WakeLockManager();
		expect(() => {
			manager.acquire();
			manager.release();
		}).not.toThrow();

		Object.defineProperty(navigator, "wakeLock", {
			configurable: true,
			value: { request: vi.fn(() => Promise.reject(new Error("denied"))) },
		});
		manager.acquire();
		await flush();
		manager.release();
		await flush();
		expect(manager.held).toBe(0);
	});

	it("honours the enabled gate, including flips while held", async () => {
		const manager = new WakeLockManager();
		manager.setEnabled(false);
		manager.acquire();
		await flush();
		expect(request).not.toHaveBeenCalled();

		manager.setEnabled(true);
		await flush();
		expect(active()).toHaveLength(1);

		manager.setEnabled(false);
		await flush();
		expect(active()).toHaveLength(0);
		manager.release();
	});
});

describe("WakeLockClaim", () => {
	it("holds and drops its share exactly once", async () => {
		const manager = new WakeLockManager();
		const a = new WakeLockClaim(manager);
		const b = new WakeLockClaim(manager);
		a.hold();
		a.hold();
		b.hold();
		expect(manager.held).toBe(2);
		a.drop();
		a.drop();
		expect(manager.held).toBe(1);
		b.drop();
		expect(manager.held).toBe(0);
		await flush();
		expect(active()).toHaveLength(0);
	});
});
