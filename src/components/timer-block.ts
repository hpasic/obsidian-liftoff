export interface TimerBlockCallbacks {
	onCompleted: () => void;
	onChanged: (workSeconds: number, restSeconds: number, intervals: number) => void;
}

type TimerPhase = "idle" | "running" | "paused" | "completed";
type RunPhase = "work" | "rest";

export class TimerBlock {
	private containerEl: HTMLElement;
	private workSeconds: number;
	private restSeconds: number;
	private intervals: number;
	private phase: TimerPhase = "idle";
	private runPhase: RunPhase = "work";
	private currentInterval: number = 1;
	private countdown: number = 0;
	private intervalId: number | null = null;
	private completed = false;

	constructor(
		parentEl: HTMLElement,
		workSeconds: number,
		restSeconds: number,
		intervals: number,
		private callbacks: TimerBlockCallbacks
	) {
		this.workSeconds = workSeconds;
		this.restSeconds = restSeconds;
		this.intervals = intervals;
		this.containerEl = parentEl.createDiv({ cls: "ln-timer-block" });
		this.render();
	}

	private render(): void {
		this.containerEl.empty();
		this.containerEl.removeClass(
			"ln-timer-block-idle",
			"ln-timer-block-running",
			"ln-timer-block-paused",
			"ln-timer-block-completed",
			"ln-timer-working",
			"ln-timer-resting"
		);
		this.containerEl.addClass(`ln-timer-block-${this.phase}`);
		if (this.phase === "running") {
			this.containerEl.addClass(this.runPhase === "work" ? "ln-timer-working" : "ln-timer-resting");
		}

		if (this.phase === "idle") {
			this.renderInputs();
		} else if (this.phase === "running" || this.phase === "paused") {
			this.renderRunning();
		} else {
			this.renderCompleted();
		}
	}

	private renderInputs(): void {
		// Input labels
		const labels = this.containerEl.createDiv({ cls: "ln-timer-block-labels" });
		labels.createSpan({ text: "WORK" });
		labels.createSpan({ text: "REST" });
		labels.createSpan({ text: "INTERVALS" });

		// Input row
		const inputs = this.containerEl.createDiv({ cls: "ln-timer-block-inputs" });

		const workInput = inputs.createEl("input", {
			cls: "ln-timer-block-input",
			attr: { type: "number", inputmode: "numeric", value: String(this.workSeconds) },
		});
		inputs.createSpan({ cls: "ln-timer-block-unit", text: "s" });

		const restInput = inputs.createEl("input", {
			cls: "ln-timer-block-input",
			attr: { type: "number", inputmode: "numeric", value: String(this.restSeconds) },
		});
		inputs.createSpan({ cls: "ln-timer-block-unit", text: "s" });

		const intervalsInput = inputs.createEl("input", {
			cls: "ln-timer-block-input ln-timer-block-input-intervals",
			attr: { type: "number", inputmode: "numeric", value: String(this.intervals) },
		});

		workInput.addEventListener("input", () => {
			this.workSeconds = parseInt(workInput.value, 10) || 1;
			this.notifyChanged();
		});
		restInput.addEventListener("input", () => {
			this.restSeconds = parseInt(restInput.value, 10) || 1;
			this.notifyChanged();
		});
		intervalsInput.addEventListener("input", () => {
			this.intervals = parseInt(intervalsInput.value, 10) || 1;
			this.notifyChanged();
		});

		// Start button
		const startBtn = this.containerEl.createEl("button", {
			cls: "ln-timer-block-start-btn",
			text: "\u25B6  Start",
		});
		startBtn.addEventListener("click", () => this.start());
	}

	private renderRunning(): void {
		const phaseLabel = this.runPhase === "work" ? "WORK" : "REST";
		const display = this.containerEl.createDiv({ cls: "ln-timer-block-display" });

		display.createDiv({
			cls: "ln-timer-block-interval-label",
			text: `Interval ${this.currentInterval}/${this.intervals}`,
		});

		display.createDiv({
			cls: `ln-timer-block-phase-label ln-timer-block-phase-${this.runPhase}`,
			text: phaseLabel,
		});

		display.createDiv({
			cls: "ln-timer-block-countdown",
			text: this.formatTime(this.countdown),
		});

		const btnText = this.phase === "paused" ? "\u25B6  Resume" : "\u23F8  Pause";
		const btn = this.containerEl.createEl("button", {
			cls: "ln-timer-block-control-btn",
			text: btnText,
		});
		btn.addEventListener("click", () => {
			if (this.phase === "paused") {
				this.resume();
			} else {
				this.pause();
			}
		});
	}

	private renderCompleted(): void {
		const display = this.containerEl.createDiv({ cls: "ln-timer-block-display" });
		display.createDiv({
			cls: "ln-timer-block-done-label",
			text: `\u2713  ${this.intervals} intervals completed`,
		});

		const resetBtn = this.containerEl.createEl("button", {
			cls: "ln-timer-block-reset-btn",
			text: "Reset",
		});
		resetBtn.addEventListener("click", () => this.reset());
	}

	private start(): void {
		this.currentInterval = 1;
		this.runPhase = "work";
		this.countdown = this.workSeconds;
		this.phase = "running";
		this.render();
		this.tick();
	}

	private pause(): void {
		this.stopInterval();
		this.phase = "paused";
		this.render();
	}

	private resume(): void {
		this.phase = "running";
		this.render();
		this.tick();
	}

	private reset(): void {
		this.stopInterval();
		this.completed = false;
		this.phase = "idle";
		this.currentInterval = 1;
		this.runPhase = "work";
		this.render();
	}

	private tick(): void {
		this.stopInterval();
		this.intervalId = window.setInterval(() => {
			this.countdown--;
			this.updateCountdown();

			if (this.countdown <= 0) {
				this.stopInterval();
				this.advancePhase();
			}
		}, 1000);
	}

	private advancePhase(): void {
		this.tryVibrate();

		if (this.runPhase === "work") {
			// Work done → start rest
			this.runPhase = "rest";
			this.countdown = this.restSeconds;
			this.render();
			this.tick();
		} else {
			// Rest done → next interval or complete
			if (this.currentInterval >= this.intervals) {
				// All intervals done
				this.completed = true;
				this.phase = "completed";
				this.render();
				this.callbacks.onCompleted();
			} else {
				// Next interval
				this.currentInterval++;
				this.runPhase = "work";
				this.countdown = this.workSeconds;
				this.render();
				this.tick();
			}
		}
	}

	private updateCountdown(): void {
		const el = this.containerEl.querySelector(".ln-timer-block-countdown");
		if (el) {
			el.textContent = this.formatTime(Math.max(0, this.countdown));
		}
	}

	private stopInterval(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	private tryVibrate(): void {
		if (navigator.vibrate) {
			navigator.vibrate(200);
		}
	}

	private formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	}

	private notifyChanged(): void {
		this.callbacks.onChanged(this.workSeconds, this.restSeconds, this.intervals);
	}

	getState(): { workSeconds: number; restSeconds: number; intervals: number; completed: boolean } {
		return {
			workSeconds: this.workSeconds,
			restSeconds: this.restSeconds,
			intervals: this.intervals,
			completed: this.completed,
		};
	}

	destroy(): void {
		this.stopInterval();
		this.containerEl.remove();
	}
}
