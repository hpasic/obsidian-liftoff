import type { WorkoutSet } from "../types";
import {
	effectiveSetType,
	NEXT_SET_TYPE,
	SET_TYPE_LABEL,
} from "../utils/sets";
import { WakeLockClaim } from "../utils/wake-lock";
import { parseWeight } from "./set-row";

export interface DurationSetRowCallbacks {
	onSetChanged: (set: WorkoutSet) => void;
	onSetCompleted: (set: WorkoutSet) => void;
	onSetRemoved: () => void;
}

export interface DurationSetRowOptions {
	/** "Get set" count-down before the clock starts; also subtracted on stop. */
	bufferSeconds?: number;
	weightUnit?: "kg" | "lbs";
}

type State = "idle" | "countdown" | "running" | "stopped";

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

/** e.g. `prev 1:00 @ 20 kg` — the weight part only for weighted holds. */
export function formatPreviousHold(previous: WorkoutSet): string {
	const weight = previous.weight > 0 ? ` @ ${previous.weight} ${previous.unit}` : "";
	return `prev ${formatTime(previous.durationSeconds ?? 0)}${weight}`;
}

export class DurationSetRow {
	private containerEl: HTMLElement;
	private displayEl!: HTMLElement;
	private setNumberBtn!: HTMLButtonElement;
	private set: WorkoutSet;
	private state: State;
	/** Countdown: when Start was tapped. Running: when the hold clock started. */
	private startTimeMs: number | null = null;
	private intervalId: number | null = null;
	private readonly bufferSeconds: number;
	private readonly weightUnit: "kg" | "lbs";
	private readonly wakeLock = new WakeLockClaim();

	constructor(
		parentEl: HTMLElement,
		private setNumber: number,
		set: WorkoutSet,
		private previous: WorkoutSet | null,
		private callbacks: DurationSetRowCallbacks,
		options: DurationSetRowOptions = {}
	) {
		this.set = { ...set };
		this.bufferSeconds = Math.max(0, Math.floor(options.bufferSeconds ?? 0));
		this.weightUnit = options.weightUnit ?? set.unit;
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
		this.containerEl.toggleClass("ln-duration-counting", this.state === "countdown");

		// Set number / type cycle
		const type = effectiveSetType(this.set);
		this.setNumberBtn = this.containerEl.createEl("button", {
			cls: `ln-set-number ln-set-type-${type}`,
		});
		this.setNumberBtn.addEventListener("click", () => {
			this.set.setType = NEXT_SET_TYPE[effectiveSetType(this.set)];
			this.callbacks.onSetChanged(this.set);
			this.render();
		});

		// Time display + previous hint
		const middle = this.containerEl.createDiv({ cls: "ln-duration-middle" });
		this.displayEl = middle.createDiv({
			cls: "ln-duration-display",
			text: this.displayText(),
		});
		if (this.state === "countdown") {
			middle.createDiv({ cls: "ln-duration-countdown-label", text: "Get set" });
		}
		this.updateSetNumber(this.setNumber, this.previous);

		// Optional added weight — empty means bodyweight
		const weightInput = this.containerEl.createEl("input", {
			cls: "ln-set-input ln-duration-weight",
			attr: {
				type: "text",
				inputmode: "decimal",
				pattern: "[0-9]*[.,]?[0-9]*",
				placeholder: this.weightUnit,
				"aria-label": `Added weight (${this.weightUnit})`,
			},
		});
		if (this.set.weight > 0) {
			weightInput.value = String(this.set.weight);
		}
		weightInput.addEventListener("input", () => {
			this.set.weight = parseWeight(weightInput.value);
			this.set.unit = this.weightUnit;
			this.callbacks.onSetChanged(this.set);
		});

		// Action button (start / cancel / stop / reset)
		const actionBtn = this.containerEl.createEl("button", {
			cls: "ln-duration-action",
		});
		if (this.state === "idle") {
			actionBtn.textContent = "Start";
			actionBtn.addClass("ln-duration-start");
		} else if (this.state === "countdown") {
			actionBtn.textContent = "Cancel";
			actionBtn.addClass("ln-duration-cancel");
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

	private displayText(): string {
		if (this.state === "countdown") return String(this.countdownRemaining());
		if (this.state === "running") return formatTime(this.elapsedSeconds());
		return formatTime(this.set.durationSeconds ?? 0);
	}

	private elapsedSeconds(): number {
		return Math.floor((Date.now() - (this.startTimeMs ?? Date.now())) / 1000);
	}

	private countdownRemaining(): number {
		return this.bufferSeconds - this.elapsedSeconds();
	}

	private onAction(): void {
		if (this.state === "idle") {
			this.startTimeMs = Date.now();
			this.state = this.bufferSeconds > 0 ? "countdown" : "running";
			this.startTicker();
			this.render();
		} else if (this.state === "countdown") {
			// Cancel before the hold began — nothing to record
			this.stopTicker();
			this.startTimeMs = null;
			this.state = "idle";
			this.render();
		} else if (this.state === "running") {
			this.stopTicker();
			// The trailing buffer covers getting out of the hold and back to the phone
			this.set.durationSeconds = Math.max(0, this.elapsedSeconds() - this.bufferSeconds);
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
		this.wakeLock.hold();
		this.intervalId = window.setInterval(() => {
			if (this.startTimeMs === null) return;
			if (this.state === "countdown" && this.countdownRemaining() <= 0) {
				// Count-down over → the hold clock starts from 0
				this.startTimeMs += this.bufferSeconds * 1000;
				this.state = "running";
				if (navigator.vibrate) navigator.vibrate(200);
				this.render();
				return;
			}
			this.displayEl.textContent = this.displayText();
		}, 250);
	}

	private stopTicker(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.wakeLock.drop();
	}

	updateSetNumber(setNumber: number, previous: WorkoutSet | null): void {
		this.setNumber = setNumber;
		this.previous = previous;
		const type = effectiveSetType(this.set);
		this.setNumberBtn.textContent = SET_TYPE_LABEL[type] || String(setNumber);
		this.setNumberBtn.setAttr("aria-label", `Set ${setNumber} (${type}). Tap to change type.`);

		const middle = this.displayEl.parentElement!;
		const hint = middle.querySelector<HTMLElement>(".ln-duration-previous");
		if (previous !== null && (this.set.durationSeconds ?? 0) === 0) {
			const previousEl = hint ?? middle.createDiv({ cls: "ln-duration-previous" });
			previousEl.textContent = formatPreviousHold(previous);
		} else {
			hint?.remove();
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
