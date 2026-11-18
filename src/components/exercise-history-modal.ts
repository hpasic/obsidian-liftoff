import { App, Modal } from "obsidian";
import type { Workout } from "../types";
import { buildExerciseHistory } from "../utils/exercise-history";

/** "History: <name>" — bests on top, then the latest sessions, newest first. */
export class ExerciseHistoryModal extends Modal {
	constructor(
		app: App,
		private exerciseName: string,
		private workouts: Workout[],
		private unit: "kg" | "lbs"
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("ln-history-modal");
		contentEl.empty();
		contentEl.addClass("ln-history");
		contentEl.createEl("h3", { text: `History: ${this.exerciseName}` });

		const { bests, sessions } = buildExerciseHistory(this.workouts, this.exerciseName, this.unit);
		const bodyEl = contentEl.createDiv({ cls: "ln-history-body" });
		if (sessions.length === 0) {
			bodyEl.createDiv({ cls: "ln-empty-state", text: "No sessions yet" });
		} else {
			if (bests.length > 0) {
				const bestsEl = bodyEl.createDiv({ cls: "ln-history-bests" });
				for (const best of bests) {
					const bestEl = bestsEl.createDiv({ cls: "ln-history-best" });
					bestEl.createDiv({ cls: "ln-history-best-value", text: best.value });
					bestEl.createDiv({ cls: "ln-history-best-label", text: best.label });
				}
			}
			const listEl = bodyEl.createDiv({ cls: "ln-history-sessions" });
			for (const session of sessions) {
				const rowEl = listEl.createDiv({ cls: "ln-history-session" });
				rowEl.createSpan({ cls: "ln-history-date", text: session.date });
				if (session.sets) rowEl.createSpan({ cls: "ln-history-sets", text: session.sets });
				if (session.note) rowEl.createDiv({ cls: "ln-history-note", text: session.note });
			}
		}

		// Bottom of the sheet, in thumb reach
		const buttons = contentEl.createDiv({ cls: "ln-modal-buttons ln-history-buttons" });
		buttons.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
