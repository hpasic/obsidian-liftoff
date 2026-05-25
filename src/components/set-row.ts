import type { WorkoutSet } from "../types";
import {
	effectiveSetType,
	NEXT_SET_TYPE,
	PR_LABEL,
	SET_TYPE_LABEL,
	type PRKind,
} from "../utils/sets";

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

		// Set number / type cycle button
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

	getRootEl(): HTMLElement {
		return this.containerEl;
	}

	flashPR(kinds: PRKind[]): void {
		if (kinds.length === 0) return;
		const existing = this.containerEl.parentElement?.querySelector(
			`.ln-pr-badge[data-row="${this.setNumber}"]`
		);
		existing?.remove();

		const badge = createDiv({ cls: "ln-pr-badge" });
		badge.setAttr("data-row", String(this.setNumber));
		badge.createSpan({ cls: "ln-pr-badge-trophy", text: "🏆" });
		badge.createSpan({
			cls: "ln-pr-badge-label",
			text: kinds.map((k) => PR_LABEL[k]).join(" · "),
		});
		this.containerEl.insertAdjacentElement("afterend", badge);
		this.containerEl.addClass("ln-set-pr");

		window.setTimeout(() => {
			badge.remove();
		}, 4000);
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
