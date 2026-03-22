import { App, Modal, Notice } from "obsidian";
import { TimerDisplay } from "../components/timer-display";
import type { LiftOffSettings } from "../types";

export class TimerModal extends Modal {
	private timerDisplay: TimerDisplay | null = null;
	private settings: LiftOffSettings;

	constructor(app: App, settings: LiftOffSettings) {
		super(app);
		this.settings = settings;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ln-timer-modal");

		contentEl.createEl("h3", { text: "Rest timer" });

		this.timerDisplay = new TimerDisplay(
			contentEl,
			this.settings.restTimerPresets,
			this.settings.defaultRestDuration,
			{
				onComplete: () => {
					new Notice("Rest timer complete!");
					if (navigator.vibrate) {
						navigator.vibrate([200, 100, 200]);
					}
				},
			}
		);
	}

	onClose(): void {
		this.timerDisplay?.destroy();
		this.contentEl.empty();
	}
}
