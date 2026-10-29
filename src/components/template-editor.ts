import { App, Modal } from "obsidian";
import type { WorkoutTemplate, ExerciseLibraryEntry, ExerciseType, TemplateExercise } from "../types";
import { EXERCISE_TYPE_LABELS } from "../utils/exercise-retype";
import { ExercisePickerModal } from "./exercise-picker";

export class TemplateEditorModal extends Modal {
	private template: WorkoutTemplate;
	private library: ExerciseLibraryEntry[];
	private recentNames: string[];
	private onSave: (template: WorkoutTemplate, catalogNames: Set<string>) => void;
	private listEl: HTMLElement = null!;
	/**
	 * Rows added this session by a catalog pick. Keyed by row identity, so a
	 * removed row takes its provenance with it; never written to the template.
	 */
	private catalogRows = new WeakSet<TemplateExercise>();

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
					const row: TemplateExercise = {
						name,
						targetSets: 3,
						exerciseType: exerciseType === "weight" ? undefined : exerciseType,
					};
					const entry = this.library.find((e) => e.name.toLowerCase() === name.toLowerCase());
					if (exerciseType === "weight" && entry?.unilateral) row.unilateral = true;
					if (source === "catalog") this.catalogRows.add(row);
					this.template.exercises.push(row);
					this.renderExercises();
				}
			).open();
		});

		const saveBtn = contentEl.createEl("button", {
			cls: "ln-te-save-btn",
			text: "Save template",
		});
		saveBtn.addEventListener("click", () => {
			this.onSave(this.template, this.catalogPickNames());
			this.close();
		});
	}

	/** Lower-cased names whose every remaining row came from a catalog pick. */
	private catalogPickNames(): Set<string> {
		const byName = new Map<string, boolean>();
		for (const row of this.template.exercises) {
			const key = row.name.toLowerCase();
			byName.set(key, (byName.get(key) ?? true) && this.catalogRows.has(row));
		}
		return new Set([...byName].filter(([, allCatalog]) => allCatalog).map(([name]) => name));
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
			// Name with the per-side toggle under it, so the controls keep their width on a phone
			const main = row.createDiv({ cls: "ln-te-exercise-main" });
			main.createSpan({ cls: "ln-te-exercise-name", text: nameText });

			// Weight rows only, by the type the row's dropdown shows
			if (this.effectiveType(ex) === "weight") {
				const sidesBtn = main.createEl("button", {
					cls: `ln-te-sides-btn ${ex.unilateral ? "ln-te-sides-btn-active" : ""}`.trimEnd(),
					text: "Per side",
					attr: { "aria-label": "Log left and right reps", "aria-pressed": String(!!ex.unilateral) },
				});
				sidesBtn.addEventListener("click", () => {
					if (ex.unilateral) delete ex.unilateral;
					else ex.unilateral = true;
					sidesBtn.toggleClass("ln-te-sides-btn-active", !!ex.unilateral);
					sidesBtn.setAttr("aria-pressed", String(!!ex.unilateral));
				});
			}

			const controls = row.createDiv({ cls: "ln-te-exercise-controls" });
			this.renderTypeSelect(controls, ex);

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

	/** The row's own type, else the library's. */
	private effectiveType(ex: TemplateExercise): ExerciseType {
		return ex.exerciseType
			?? this.library.find((e) => e.name.toLowerCase() === ex.name.toLowerCase())?.exerciseType
			?? "weight";
	}

	/** Per-row type. Shows the effective type: the row's own, else the library's. */
	private renderTypeSelect(parentEl: HTMLElement, ex: TemplateExercise): void {
		const select = parentEl.createEl("select", {
			cls: "ln-te-type-select dropdown",
			attr: { "aria-label": "Exercise type" },
		});
		for (const type of ["weight", "timer", "duration"] as const) {
			select.createEl("option", { text: EXERCISE_TYPE_LABELS[type], attr: { value: type } });
		}
		select.value = this.effectiveType(ex);
		select.addEventListener("change", () => {
			// Explicit, "weight" included, so it wins over the library's type
			ex.exerciseType = select.value as ExerciseType;
			this.renderExercises();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
