import type { WorkoutSet } from "../types";

function parseWeight(value: string): number {
	const n = parseFloat(value.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}

export interface SetRowCallbacks {
	onSetChanged: (set: WorkoutSet) => void;
	onSetCompleted: (set: WorkoutSet) => void;
	onSetRemoved: () => void;
}

export class SetRow {
	private containerEl: HTMLElement;
	private weightInput: HTMLInputElement;
	private repsInput: HTMLInputElement;
	private checkBtn: HTMLButtonElement;
	private set: WorkoutSet;

	constructor(
		parentEl: HTMLElement,
		private setNumber: number,
		set: WorkoutSet,
		private previousHint: string | null,
		private callbacks: SetRowCallbacks
	) {
		this.set = { ...set };
		this.containerEl = parentEl.createDiv({ cls: "ln-set-row" });
		this.weightInput = null!;
		this.repsInput = null!;
		this.checkBtn = null!;
		this.render();
	}

	private render(): void {
		this.containerEl.empty();

		if (this.set.completed) {
			this.containerEl.addClass("ln-set-completed");
		} else {
			this.containerEl.removeClass("ln-set-completed");
		}

		// Set number
		this.containerEl.createSpan({
			cls: "ln-set-number",
			text: String(this.setNumber),
		});

		// Weight input
		this.weightInput = this.containerEl.createEl("input", {
			cls: "ln-set-input ln-weight-input",
			attr: {
				type: "text",
				inputmode: "decimal",
				pattern: "[0-9]*[.,]?[0-9]*",
				placeholder: this.previousHint?.split("x")[0]?.trim() ?? "",
			},
		});
		if (this.set.weight > 0) {
			this.weightInput.value = String(this.set.weight);
		}
		this.weightInput.addEventListener("input", () => {
			this.set.weight = parseWeight(this.weightInput.value);
			this.callbacks.onSetChanged(this.set);
		});

		// Reps input
		this.repsInput = this.containerEl.createEl("input", {
			cls: "ln-set-input ln-reps-input",
			attr: {
				type: "number",
				inputmode: "numeric",
				placeholder: this.previousHint?.split("x")[1]?.trim() ?? "",
			},
		});
		if (this.set.reps > 0) {
			this.repsInput.value = String(this.set.reps);
		}
		this.repsInput.addEventListener("input", () => {
			this.set.reps = parseInt(this.repsInput.value, 10) || 0;
			this.callbacks.onSetChanged(this.set);
		});

		// Check button
		this.checkBtn = this.containerEl.createEl("button", {
			cls: `ln-set-check ${this.set.completed ? "ln-set-check-done" : ""}`,
			text: "\u2713",
		});
		this.checkBtn.addEventListener("click", () => {
			this.set.completed = !this.set.completed;
			this.set.weight = parseWeight(this.weightInput.value);
			this.set.reps = parseInt(this.repsInput.value, 10) || 0;
			this.render();
			this.callbacks.onSetCompleted(this.set);
		});

		// Remove button
		const removeBtn = this.containerEl.createEl("button", {
			cls: "ln-set-remove",
			text: "×",
			attr: { "aria-label": "Remove set" },
		});
		removeBtn.addEventListener("click", () => {
			this.callbacks.onSetRemoved();
		});
	}

	getSet(): WorkoutSet {
		return { ...this.set };
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
