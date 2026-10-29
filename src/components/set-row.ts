import type { WorkoutSet } from "../types";
import {
	effectiveSetType,
	NEXT_SET_TYPE,
	PR_LABEL,
	SET_TYPE_LABEL,
	type PRKind,
} from "../utils/sets";

export function parseWeight(value: string): number {
	const n = parseFloat(value.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}

export interface SetRowCallbacks {
	onSetChanged: (set: WorkoutSet) => void;
	onSetCompleted: (set: WorkoutSet) => void;
	onSetRemoved: () => void;
}

export interface SetRowOptions {
	/** Show left and right rep inputs; the set carries `repsRight`. */
	unilateral?: boolean;
}

export class SetRow {
	private containerEl: HTMLElement;
	private weightInput: HTMLInputElement;
	private repsInput: HTMLInputElement;
	private repsRightInput: HTMLInputElement | null = null;
	private checkBtn: HTMLButtonElement;
	private set: WorkoutSet;
	private weightUnit: "kg" | "lbs";

	constructor(
		parentEl: HTMLElement,
		private setNumber: number,
		set: WorkoutSet,
		private previous: WorkoutSet | null,
		private callbacks: SetRowCallbacks,
		private options: SetRowOptions = {}
	) {
		this.set = { ...set };
		if (options.unilateral) this.set.repsRight ??= 0;
		this.weightUnit = set.unit;
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
		const weightEl = this.containerEl.createDiv({ cls: "ln-set-weight" });
		this.weightInput = weightEl.createEl("input", {
			cls: "ln-set-input ln-weight-input",
			attr: {
				type: "text",
				inputmode: "decimal",
				pattern: "[0-9]*[.,]?[0-9]*",
				"aria-label": `Weight (${this.weightUnit})`,
				placeholder: this.weightPlaceholder(),
			},
		});
		// Tap to relabel the row kg <-> lbs; the typed number stays as the plate says
		const unitBtn = weightEl.createEl("button", {
			cls: "ln-set-weight-unit",
			text: this.weightUnit,
			attr: { type: "button", "aria-label": this.unitLabel() },
		});
		// Keep focus (and the keyboard) on the weight input while typing
		unitBtn.addEventListener("mousedown", (e) => e.preventDefault());
		unitBtn.addEventListener("click", () => {
			this.weightUnit = this.weightUnit === "kg" ? "lbs" : "kg";
			this.set.unit = this.weightUnit;
			unitBtn.textContent = this.weightUnit;
			unitBtn.setAttr("aria-label", this.unitLabel());
			this.weightInput.setAttr("aria-label", `Weight (${this.weightUnit})`);
			this.weightInput.setAttr("placeholder", this.weightPlaceholder());
			this.callbacks.onSetChanged(this.set);
		});
		if (this.set.weight > 0) {
			this.weightInput.value = String(this.set.weight);
		}
		this.weightInput.addEventListener("input", () => {
			this.set.weight = parseWeight(this.weightInput.value);
			this.callbacks.onSetChanged(this.set);
		});

		// Reps input — left and right side by side for a unilateral exercise
		if (this.options.unilateral) {
			const repsEl = this.containerEl.createDiv({ cls: "ln-set-reps-lr" });
			this.repsInput = this.createRepsInput(repsEl, "ln-reps-left", "Left reps",
				this.previous ? String(this.previous.reps) : "L", this.set.reps);
			this.repsRightInput = this.createRepsInput(repsEl, "ln-reps-right", "Right reps",
				this.previous?.repsRight !== undefined ? String(this.previous.repsRight) : "R",
				this.set.repsRight ?? 0);
			this.repsRightInput.addEventListener("input", () => {
				this.set.repsRight = this.readReps(this.repsRightInput);
				this.callbacks.onSetChanged(this.set);
			});
		} else {
			this.repsInput = this.createRepsInput(this.containerEl, "", null,
				this.previous ? String(this.previous.reps) : "", this.set.reps);
		}
		this.repsInput.addEventListener("input", () => {
			this.set.reps = this.readReps(this.repsInput);
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
			this.set.reps = this.readReps(this.repsInput);
			if (this.repsRightInput) this.set.repsRight = this.readReps(this.repsRightInput);
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

	private createRepsInput(
		parentEl: HTMLElement,
		sideCls: string,
		label: string | null,
		placeholder: string,
		value: number
	): HTMLInputElement {
		const el = parentEl.createEl("input", {
			cls: `ln-set-input ln-reps-input ${sideCls}`.trimEnd(),
			attr: {
				type: "number",
				inputmode: "numeric",
				placeholder,
				...(label ? { "aria-label": label } : {}),
			},
		});
		if (value > 0) el.value = String(value);
		return el;
	}

	private readReps(el: HTMLInputElement | null): number {
		return el ? parseInt(el.value, 10) || 0 : 0;
	}

	private unitLabel(): string {
		return `Unit ${this.weightUnit}. Tap to switch to ${this.weightUnit === "kg" ? "lbs" : "kg"}.`;
	}

	/** Previous weight; its unit only when it differs from this row's badge. */
	private weightPlaceholder(): string {
		const prev = this.previous;
		if (!prev) return "";
		if (prev.weight <= 0) return "0";
		return prev.unit === this.weightUnit ? String(prev.weight) : `${prev.weight} ${prev.unit}`;
	}

	getSet(): WorkoutSet {
		return { ...this.set };
	}

	getRootEl(): HTMLElement {
		return this.containerEl;
	}

	showPR(kinds: PRKind[]): void {
		this.clearPR();
		if (kinds.length === 0) return;

		const badge = createDiv({ cls: "ln-pr-badge" });
		badge.setAttr("data-row", String(this.setNumber));
		badge.createSpan({ cls: "ln-pr-badge-trophy", text: "🏆" });
		badge.createSpan({
			cls: "ln-pr-badge-label",
			text: kinds.map((k) => PR_LABEL[k]).join(" · "),
		});
		this.containerEl.insertAdjacentElement("afterend", badge);
		this.containerEl.addClass("ln-set-pr");
	}

	clearPR(): void {
		this.containerEl.removeClass("ln-set-pr");
		const existing = this.containerEl.parentElement?.querySelector(
			`.ln-pr-badge[data-row="${this.setNumber}"]`
		);
		existing?.remove();
	}

	destroy(): void {
		this.containerEl.remove();
	}
}
