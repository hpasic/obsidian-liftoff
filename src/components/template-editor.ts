import { App, Modal } from "obsidian";
import type { WorkoutTemplate, ExerciseLibraryEntry } from "../types";
import { ExercisePickerModal } from "./exercise-picker";

export class TemplateEditorModal extends Modal {
	private template: WorkoutTemplate;
	private library: ExerciseLibraryEntry[];
	private recentNames: string[];
	private onSave: (template: WorkoutTemplate) => void;
	private listEl: HTMLElement = null!;

	constructor(
		app: App,
		template: WorkoutTemplate,
		library: ExerciseLibraryEntry[],
		recentNames: string[],
		onSave: (template: WorkoutTemplate) => void
	) {
		super(app);
		this.template = {
			...template,
			exercises: template.exercises.map((e) => ({ ...e })),
		};
		this.library = library;
		this.recentNames = recentNames;
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ln-template-editor");

		contentEl.createEl("h3", { text: this.template.name });

		this.listEl = contentEl.createDiv({ cls: "ln-te-exercises" });
		this.renderExercises();

		const addBtn = contentEl.createEl("button", {
			cls: "ln-te-add-btn",
			text: "+ add exercise",
		});
		addBtn.addEventListener("click", () => {
			new ExercisePickerModal(
				this.app,
				this.library,
				this.recentNames,
				(name, exerciseType) => {
					this.template.exercises.push({
						name,
						targetSets: 3,
						exerciseType: exerciseType === "timer" ? "timer" : undefined,
					});
					this.renderExercises();
				}
			).open();
		});

		const saveBtn = contentEl.createEl("button", {
			cls: "ln-te-save-btn",
			text: "Save template",
		});
		saveBtn.addEventListener("click", () => {
			this.onSave(this.template);
			this.close();
		});
	}

	private renderExercises(): void {
		this.listEl.empty();

		if (this.template.exercises.length === 0) {
			this.listEl.createDiv({
				cls: "ln-empty-state",
				text: "No exercises yet. Add some!",
			});
			return;
		}

		for (let i = 0; i < this.template.exercises.length; i++) {
			const ex = this.template.exercises[i]!;
			const isTimer = ex.exerciseType === "timer";
			const row = this.listEl.createDiv({ cls: "ln-te-exercise-row" });

			const nameText = isTimer ? `\u23F1 ${ex.name}` : ex.name;
			row.createSpan({ cls: "ln-te-exercise-name", text: nameText });

			const controls = row.createDiv({ cls: "ln-te-exercise-controls" });

			const minusBtn = controls.createEl("button", {
				cls: "ln-te-sets-btn",
				text: "\u2212",
			});
			const setsLabel = controls.createSpan({
				cls: "ln-te-sets-label",
				text: `${ex.targetSets} ${isTimer ? "intervals" : "sets"}`,
			});
			const plusBtn = controls.createEl("button", {
				cls: "ln-te-sets-btn",
				text: "+",
			});

			minusBtn.addEventListener("click", () => {
				if (ex.targetSets > 1) {
					ex.targetSets--;
					setsLabel.textContent = `${ex.targetSets} ${isTimer ? "intervals" : "sets"}`;
				}
			});
			plusBtn.addEventListener("click", () => {
				if (ex.targetSets < 20) {
					ex.targetSets++;
					setsLabel.textContent = `${ex.targetSets} ${isTimer ? "intervals" : "sets"}`;
				}
			});

			const removeBtn = controls.createEl("button", {
				cls: "ln-te-remove-btn",
				text: "\u00D7",
			});
			removeBtn.addEventListener("click", () => {
				this.template.exercises.splice(i, 1);
				this.renderExercises();
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
