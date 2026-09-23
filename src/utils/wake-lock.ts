/**
 * Ref-counted screen wake lock. Every running timer acquires once and releases
 * once; the screen is held awake while at least one is running. A no-op where
 * the Screen Wake Lock API is missing (e.g. some desktop builds).
 */
export class WakeLockManager {
	private count = 0;
	private enabled = true;
	private sentinel: WakeLockSentinel | null = null;
	private pending = false;
	private readonly onVisibilityChange = () => {
		if (document.visibilityState === "visible") this.request();
	};

	/** Gate from the `keepScreenAwake` setting. Takes effect immediately. */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (enabled) this.request();
		else this.releaseSentinel();
	}

	acquire(): void {
		this.count++;
		if (this.count === 1) {
			document.addEventListener("visibilitychange", this.onVisibilityChange);
		}
		this.request();
	}

	release(): void {
		if (this.count === 0) return;
		this.count--;
		if (this.count === 0) {
			document.removeEventListener("visibilitychange", this.onVisibilityChange);
			this.releaseSentinel();
		}
	}

	/** Drop every hold, e.g. on plugin unload. */
	reset(): void {
		if (this.count > 0) {
			this.count = 1;
			this.release();
		}
	}

	get held(): number {
		return this.count;
	}

	private request(): void {
		// The browser drops the lock whenever the page is hidden; the
		// visibilitychange handler asks again once it is visible
		if (!this.enabled || this.count === 0 || this.sentinel || this.pending) return;
		const api = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
		if (!api || document.visibilityState !== "visible") return;
		this.pending = true;
		api.request("screen").then(
			(sentinel) => {
				this.pending = false;
				if (!this.enabled || this.count === 0) {
					void sentinel.release().catch(() => {});
					return;
				}
				this.sentinel = sentinel;
				sentinel.addEventListener("release", () => {
					if (this.sentinel === sentinel) this.sentinel = null;
				});
			},
			() => {
				// Denied (low battery, permissions policy): nothing to do
				this.pending = false;
			}
		);
	}

	private releaseSentinel(): void {
		const sentinel = this.sentinel;
		this.sentinel = null;
		if (sentinel) void sentinel.release().catch(() => {});
	}
}

export const screenWakeLock = new WakeLockManager();

/** One component's claim on the shared lock — safe to hold or drop repeatedly. */
export class WakeLockClaim {
	private holding = false;

	constructor(private manager: WakeLockManager = screenWakeLock) {}

	hold(): void {
		if (this.holding) return;
		this.holding = true;
		this.manager.acquire();
	}

	drop(): void {
		if (!this.holding) return;
		this.holding = false;
		this.manager.release();
	}
}
