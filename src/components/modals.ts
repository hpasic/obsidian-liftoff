import { App, Modal } from "obsidian";
import type { ExerciseType } from "../types";
import { EXERCISE_TYPE_LABELS } from "../utils/exercise-retype";

export class ConfirmModal extends Modal {
	private message: string;
	private resolve: (value: boolean) => void = () => {};

	constructor(app: App, message: string) {
		super(app);
		this.message = message;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.message, cls: "ln-modal-message" });

		const btnContainer = contentEl.createDiv({ cls: "ln-modal-buttons" });

		const cancelBtn = btnContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.resolve(false);
			this.close();
		});

		const confirmBtn = btnContainer.createEl("button", {
			text: "Confirm",
			cls: "mod-cta",
		});
		confirmBtn.addEventListener("click", () => {
			this.resolve(true);
			this.close();
		});
	}

	onClose(): void {
		this.resolve(false);
		this.contentEl.empty();
	}

	openAndWait(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

export class TextInputModal extends Modal {
	private title: string;
	private placeholder: string;
	private resolve: (value: string | null) => void = () => {};

	constructor(app: App, title: string, placeholder: string = "") {
		super(app);
		this.title = title;
		this.placeholder = placeholder;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.title, cls: "ln-modal-message" });

		const input = contentEl.createEl("input", {
			type: "text",
			cls: "ln-modal-input",
			placeholder: this.placeholder,
		});

		const btnContainer = contentEl.createDiv({ cls: "ln-modal-buttons" });

		const cancelBtn = btnContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.resolve(null);
			this.close();
		});

		const confirmBtn = btnContainer.createEl("button", {
			text: "Create",
			cls: "mod-cta",
		});

		const submit = () => {
			const value = input.value.trim();
			if (value) {
				this.resolve(value);
				this.close();
			}
		};

		confirmBtn.addEventListener("click", submit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") submit();
		});

		// Focus input after modal animation
		window.setTimeout(() => input.focus(), 50);
	}

	onClose(): void {
		this.resolve(null);
		this.contentEl.empty();
	}

	openAndWait(): Promise<string | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

/** Pick weight / timer / duration. Resolves null on cancel or on the current type. */
export class ExerciseTypeModal extends Modal {
	private resolve: (value: ExerciseType | null) => void = () => {};

	constructor(app: App, private exerciseName: string, private current: ExerciseType) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: `Change type of "${this.exerciseName}"`, cls: "ln-modal-message" });

		const toggle = contentEl.createDiv({ cls: "ln-el-type-toggle" });
		for (const type of ["weight", "timer", "duration"] as const) {
			const btn = toggle.createEl("button", {
				cls: `ln-el-type-btn ln-type-choice-btn${type === this.current ? " ln-el-type-btn-active" : ""}`,
				text: EXERCISE_TYPE_LABELS[type],
				attr: { "data-type": type },
			});
			btn.addEventListener("click", () => {
				this.resolve(type === this.current ? null : type);
				this.close();
			});
		}

		const btnContainer = contentEl.createDiv({ cls: "ln-modal-buttons" });
		const cancelBtn = btnContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.resolve(null);
		this.contentEl.empty();
	}

	openAndWait(): Promise<ExerciseType | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}
