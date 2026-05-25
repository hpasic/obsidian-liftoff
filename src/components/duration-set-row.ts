import type { WorkoutSet } from "../types";
import {
	effectiveSetType,
	NEXT_SET_TYPE,
	SET_TYPE_LABEL,
} from "../utils/sets";

export interface DurationSetRowCallbacks {
	onSetChanged: (set: WorkoutSet) => void;
	onSetCompleted: (set: WorkoutSet) => void;
	onSetRemoved: () => void;
}

type State = "idle" | "running" | "stopped";

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

export class DurationSetRow {
	private containerEl: HTMLElement;
	private displayEl!: HTMLElement;
	private set: WorkoutSet;
	private state: State;
	private startTimeMs: number | null = null;
	private intervalId: number | null = null;

	constructor(
		parentEl: HTMLElement,
		private setNumber: number,
		set: WorkoutSet,
		private previousSeconds: number | null,
		private callbacks: DurationSetRowCallbacks
	) {
		this.set = { ...set };
		// Recover state from saved set:
		// - completed = stopped (locked in)
		// - has durationSeconds, not completed = stopped (mid-edit, can resume)
		// - otherwise idle
		if (set.completed) {
			this.state = "stopped";
		} else if ((set.durationSeconds ?? 0) > 0) {
			this.state = "stopped";
		} else {
			this.state = "idle";
		}
		this.containerEl = parentEl.createDiv({ cls: "ln-duration-row" });
		this.render();
	}

	private render(): void {
		this.containerEl.empty();

		if (this.set.completed) {
			this.containerEl.addClass("ln-set-completed");
		} else {
			this.containerEl.removeClass("ln-set-completed");
		}

		// Set number / type cycle
		const type = effectiveSetType(this.set);
		const typeLabel = SET_TYPE_LABEL[type];
		const setNumberBtn = this.containerEl.createEl("button", {
			cls: `ln-set-number ln-set-type-${type}`,
			text: typeLabel || String(this.setNumber),
			attr: { "aria-label": `Set ${this.setNumber} (${type}). Tap to change type.` },
		});
		setNumberBtn.addEventListener("click", () => {
			this.set.setType = NEXT_SET_TYPE[effectiveSetType(this.set)];
			this.callbacks.onSetChanged(this.set);
			this.render();
		});

		// Time display + previous hint
		const middle = this.containerEl.createDiv({ cls: "ln-duration-middle" });
		this.displayEl = middle.createDiv({
			cls: "ln-duration-display",
			text: formatTime(this.set.durationSeconds ?? 0),
		});
		if (this.previousSeconds !== null && (this.set.durationSeconds ?? 0) === 0) {
			middle.createDiv({
				cls: "ln-duration-previous",
				text: `prev ${formatTime(this.previousSeconds)}`,
			});
		}

		// Action button (start / stop / reset)
		const actionBtn = this.containerEl.createEl("button", {
			cls: "ln-duration-action",
		});
		if (this.state === "idle") {
			actionBtn.textContent = "Start";
			actionBtn.addClass("ln-duration-start");
		} else if (this.state === "running") {
			actionBtn.textContent = "Stop";
			actionBtn.addClass("ln-duration-stop");
		} else {
			actionBtn.textContent = "↺";
			actionBtn.setAttr("aria-label", "Reset timer");
		}
		actionBtn.addEventListener("click", () => this.onAction());

		// Remove button
		const removeBtn = this.containerEl.createEl("button", {
			cls: "ln-set-remove",
			text: "×",
			attr: { "aria-label": "Remove set" },
		});
		removeBtn.addEventListener("click", () => {
			this.stopTicker();
			this.callbacks.onSetRemoved();
		});
	}

	private onAction(): void {
		if (this.state === "idle") {
			this.state = "running";
			this.startTimeMs = Date.now();
			this.startTicker();
			this.render();
		} else if (this.state === "running") {
			this.stopTicker();
			const elapsed = Math.floor((Date.now() - (this.startTimeMs ?? Date.now())) / 1000);
			this.set.durationSeconds = elapsed;
			this.set.completed = true;
			this.state = "stopped";
			this.render();
			this.callbacks.onSetCompleted(this.set);
		} else {
			// stopped → reset to idle
			this.set.durationSeconds = 0;
			this.set.completed = false;
			this.startTimeMs = null;
			this.state = "idle";
			this.render();
			this.callbacks.onSetChanged(this.set);
		}
	}

	private startTicker(): void {
		this.stopTicker();
		this.intervalId = window.setInterval(() => {
			if (this.startTimeMs === null) return;
			const elapsed = Math.floor((Date.now() - this.startTimeMs) / 1000);
			this.displayEl.textContent = formatTime(elapsed);
		}, 250);
	}

	private stopTicker(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	getSet(): WorkoutSet {
		return { ...this.set };
	}

	getRootEl(): HTMLElement {
		return this.containerEl;
	}

	destroy(): void {
		this.stopTicker();
		this.containerEl.remove();
	}
}
