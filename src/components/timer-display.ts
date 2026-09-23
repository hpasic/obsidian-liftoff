import { WakeLockClaim } from "../utils/wake-lock";

export interface TimerCallbacks {
	onComplete: () => void;
}

export class TimerDisplay {
	private containerEl: HTMLElement;
	private displayEl: HTMLElement;
	private intervalId: number | null = null;
	private remainingSeconds: number;
	private running: boolean = false;
	private readonly wakeLock = new WakeLockClaim();

	constructor(
		parentEl: HTMLElement,
		private presets: number[],
		private defaultDuration: number,
		private callbacks: TimerCallbacks
	) {
		this.remainingSeconds = defaultDuration;
		this.containerEl = parentEl.createDiv({ cls: "ln-timer" });
		this.displayEl = null!;
		this.render();
	}

	private render(): void {
		this.containerEl.empty();

		this.displayEl = this.containerEl.createDiv({ cls: "ln-timer-display" });
		this.updateDisplay();

		const presetsEl = this.containerEl.createDiv({ cls: "ln-timer-presets" });
		for (const seconds of this.presets) {
			const btn = presetsEl.createEl("button", {
				cls: `ln-timer-preset ${seconds === this.remainingSeconds && !this.running ? "ln-timer-preset-active" : ""}`,
				text: this.formatTime(seconds),
			});
			btn.addEventListener("click", () => {
				this.stop();
				this.remainingSeconds = seconds;
				this.render();
			});
		}

		const controlsEl = this.containerEl.createDiv({ cls: "ln-timer-controls" });

		const resetBtn = controlsEl.createEl("button", {
			cls: "ln-timer-btn ln-timer-reset",
			text: "Reset",
		});
		resetBtn.addEventListener("click", () => {
			this.stop();
			this.remainingSeconds = this.defaultDuration;
			this.render();
		});

		const startStopBtn = controlsEl.createEl("button", {
			cls: "ln-timer-btn ln-timer-start",
			text: this.running ? "Pause" : "Start",
		});
		startStopBtn.addEventListener("click", () => {
			if (this.running) {
				this.stop();
			} else {
				this.start();
			}
			this.render();
		});
	}

	private start(): void {
		if (this.running) return;
		this.running = true;
		this.wakeLock.hold();
		this.intervalId = window.setInterval(() => {
			this.remainingSeconds--;
			this.updateDisplay();
			if (this.remainingSeconds <= 0) {
				this.stop();
				this.callbacks.onComplete();
				this.render();
			}
		}, 1000);
	}

	private stop(): void {
		this.running = false;
		this.wakeLock.drop();
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	private updateDisplay(): void {
		this.displayEl.textContent = this.formatTime(Math.max(0, this.remainingSeconds));
	}

	private formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	}

	destroy(): void {
		this.stop();
		this.containerEl.remove();
	}
}
