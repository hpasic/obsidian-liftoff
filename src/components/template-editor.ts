import { App, Modal } from "obsidian";
import type { WorkoutTemplate, ExerciseLibraryEntry } from "../types";
import { ExercisePickerModal } from "./exercise-picker";

export class TemplateEditorModal extends Modal {
	private template: WorkoutTemplate;
	private library: ExerciseLibraryEntry[];
	private recentNames: string[];
	private onSave: (template: WorkoutTemplate, catalogNames: Set<string>) => void;
	private listEl: HTMLElement = null!;
	/** Lower-cased names picked from the built-in catalog, for the library on save. */
	private catalogNames = new Set<string>();

	constructor(
		app: App,
		template: WorkoutTemplate,
		library: ExerciseLibraryEntry[],
		recentNames: string[],
		onSave: (template: WorkoutTemplate, catalogNames: Set<string>) => void
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
				(name, exerciseType, source) => {
					if (source === "catalog") this.catalogNames.add(name.toLowerCase());
					this.template.exercises.push({
						name,
						targetSets: 3,
						exerciseType: exerciseType === "weight" ? undefined : exerciseType,
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
			this.onSave(this.template, this.catalogNames);
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
			const isDuration = ex.exerciseType === "duration";
			const countLabel = isTimer ? "intervals" : isDuration ? "holds" : "sets";
			const row = this.listEl.createDiv({ cls: "ln-te-exercise-row" });

			let nameText: string;
			if (isTimer) nameText = `\u23F1 ${ex.name}`;
			else if (isDuration) nameText = `\u23F2 ${ex.name}`;
			else nameText = ex.name;
			row.createSpan({ cls: "ln-te-exercise-name", text: nameText });

			const controls = row.createDiv({ cls: "ln-te-exercise-controls" });

			const minusBtn = controls.createEl("button", {
				cls: "ln-te-sets-btn",
				text: "\u2212",
			});
			const setsLabel = controls.createSpan({
				cls: "ln-te-sets-label",
				text: `${ex.targetSets} ${countLabel}`,
			});
			const plusBtn = controls.createEl("button", {
				cls: "ln-te-sets-btn",
				text: "+",
			});

			minusBtn.addEventListener("click", () => {
				if (ex.targetSets > 1) {
					ex.targetSets--;
					setsLabel.textContent = `${ex.targetSets} ${countLabel}`;
				}
			});
			plusBtn.addEventListener("click", () => {
				if (ex.targetSets < 20) {
					ex.targetSets++;
					setsLabel.textContent = `${ex.targetSets} ${countLabel}`;
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
