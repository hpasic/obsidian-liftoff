import { App, Modal, Notice } from "obsidian";
import type { ExerciseLibraryEntry, ExerciseType } from "../types";
import { typeChangeNotice } from "../utils/exercise-retype";
import { ConfirmModal } from "./modals";

/** Pushes a saved type change to the templates; resolves to how many changed. */
export type OnExerciseTypeChanged = (name: string, type: ExerciseType) => Promise<number>;

export class ExerciseLibraryModal extends Modal {
	private library: ExerciseLibraryEntry[];
	private onSave: (library: ExerciseLibraryEntry[]) => void;
	private listEl: HTMLElement = null!;
	private editingIndex: number | null = null;

	constructor(
		app: App,
		library: ExerciseLibraryEntry[],
		onSave: (library: ExerciseLibraryEntry[]) => void,
		private onTypeChanged?: OnExerciseTypeChanged
	) {
		super(app);
		this.library = library.map((e) => ({ ...e }));
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ln-exercise-library");

		contentEl.createEl("h3", { text: "Exercise library" });

		this.listEl = contentEl.createDiv({ cls: "ln-el-list" });
		this.renderList();
	}

	private renderList(): void {
		this.listEl.empty();

		if (this.library.length === 0) {
			this.listEl.createDiv({
				cls: "ln-empty-state",
				text: "No exercises yet. They\u2019ll appear here as you use them.",
			});
			return;
		}

		const sorted = this.library
			.map((e, i) => ({ entry: e, index: i }))
			.sort((a, b) => a.entry.name.localeCompare(b.entry.name));

		for (const { entry, index } of sorted) {
			if (this.editingIndex === index) {
				this.renderEditRow(entry, index);
			} else {
				this.renderRow(entry, index);
			}
		}
	}

	private renderRow(entry: ExerciseLibraryEntry, index: number): void {
		const row = this.listEl.createDiv({ cls: "ln-el-row" });

		const info = row.createDiv({ cls: "ln-el-info" });
		const nameRow = info.createDiv({ cls: "ln-el-name-row" });

		if (entry.exerciseType === "timer") {
			nameRow.createSpan({ cls: "ln-el-type-badge", text: "\u23F1" });
		} else if (entry.exerciseType === "duration") {
			nameRow.createSpan({ cls: "ln-el-type-badge", text: "\u23F2" });
		}
		nameRow.createSpan({ cls: "ln-el-name", text: entry.name });
		if (entry.unilateral) {
			nameRow.createSpan({ cls: "ln-el-unilateral-badge", text: "L / R" });
		}

		if (entry.notes) {
			info.createDiv({ cls: "ln-el-notes-preview", text: entry.notes });
		}

		const actions = row.createDiv({ cls: "ln-el-actions" });

		const editBtn = actions.createEl("button", {
			cls: "ln-el-action-btn",
			text: "\u270E",
		});
		editBtn.addEventListener("click", () => {
			this.editingIndex = index;
			this.renderList();
		});

		const deleteBtn = actions.createEl("button", {
			cls: "ln-el-action-btn ln-el-delete-btn",
			text: "\u00D7",
		});
		deleteBtn.addEventListener("click", () => {
			void (async () => {
				const confirmed = await new ConfirmModal(
					this.app,
					`Delete "${entry.name}"?`
				).openAndWait();
				if (confirmed) {
					this.library.splice(index, 1);
					this.editingIndex = null;
					this.save();
					this.renderList();
				}
			})();
		});
	}

	private renderEditRow(entry: ExerciseLibraryEntry, index: number): void {
		const row = this.listEl.createDiv({ cls: "ln-el-row ln-el-row-editing" });

		// Name input
		row.createDiv({ cls: "ln-el-edit-label", text: "Name" });
		const nameInput = row.createEl("input", {
			cls: "ln-el-edit-input",
			attr: { type: "text", value: entry.name },
		});

		// Type toggle
		const typeRow = row.createDiv({ cls: "ln-el-type-row" });
		typeRow.createSpan({ cls: "ln-el-edit-label", text: "Type" });
		const typeToggle = typeRow.createDiv({ cls: "ln-el-type-toggle" });

		let currentType: ExerciseType = entry.exerciseType ?? "weight";

		const weightBtn = typeToggle.createEl("button", {
			cls: `ln-el-type-btn ${currentType === "weight" ? "ln-el-type-btn-active" : ""}`,
			text: "Weight",
		});
		const timerBtn = typeToggle.createEl("button", {
			cls: `ln-el-type-btn ${currentType === "timer" ? "ln-el-type-btn-active" : ""}`,
			text: "Timer",
		});
		const durationBtn = typeToggle.createEl("button", {
			cls: `ln-el-type-btn ${currentType === "duration" ? "ln-el-type-btn-active" : ""}`,
			text: "Duration",
		});

		const setActive = (which: ExerciseType): void => {
			currentType = which;
			for (const [btn, t] of [
				[weightBtn, "weight"] as const,
				[timerBtn, "timer"] as const,
				[durationBtn, "duration"] as const,
			]) {
				if (t === which) btn.addClass("ln-el-type-btn-active");
				else btn.removeClass("ln-el-type-btn-active");
			}
		};
		weightBtn.addEventListener("click", () => setActive("weight"));
		timerBtn.addEventListener("click", () => setActive("timer"));
		durationBtn.addEventListener("click", () => setActive("duration"));

		// Sides toggle — weight exercises only: left and right reps per set
		const sidesRow = row.createDiv({ cls: "ln-el-type-row ln-el-sides-row" });
		sidesRow.createSpan({ cls: "ln-el-edit-label", text: "Reps" });
		const sidesToggle = sidesRow.createDiv({ cls: "ln-el-type-toggle" });
		let unilateral = entry.unilateral === true;
		const bothBtn = sidesToggle.createEl("button", { cls: "ln-el-type-btn ln-el-sides-both", text: "Both sides" });
		const eachBtn = sidesToggle.createEl("button", { cls: "ln-el-type-btn ln-el-sides-each", text: "Left / right" });
		const renderSides = (): void => {
			bothBtn.toggleClass("ln-el-type-btn-active", !unilateral);
			eachBtn.toggleClass("ln-el-type-btn-active", unilateral);
			sidesRow.toggleClass("ln-el-hidden", currentType !== "weight");
		};
		bothBtn.addEventListener("click", () => {
			unilateral = false;
			renderSides();
		});
		eachBtn.addEventListener("click", () => {
			unilateral = true;
			renderSides();
		});
		for (const btn of [weightBtn, timerBtn, durationBtn]) btn.addEventListener("click", renderSides);
		renderSides();

		// Notes
		row.createDiv({ cls: "ln-el-edit-label", text: "Notes" });
		const notesInput = row.createEl("textarea", {
			cls: "ln-el-edit-textarea",
			attr: { placeholder: "E.g. Use narrow grip, keep core tight", rows: "2" },
		});
		notesInput.value = entry.notes ?? "";

		// Save / Cancel buttons
		const btnRow = row.createDiv({ cls: "ln-el-edit-buttons" });

		const cancelBtn = btnRow.createEl("button", {
			cls: "ln-el-edit-cancel",
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => {
			this.editingIndex = null;
			this.renderList();
		});

		const saveBtn = btnRow.createEl("button", {
			cls: "ln-el-edit-save",
			text: "Save",
		});
		saveBtn.addEventListener("click", () => {
			const newName = nameInput.value.trim();
			if (!newName) return;
			// Templates still carry the name they were saved with
			const oldName = entry.name;
			const typeChanged = (entry.exerciseType ?? "weight") !== currentType;
			entry.name = newName;
			entry.exerciseType = currentType === "weight" ? undefined : currentType;
			if (currentType === "weight" && unilateral) entry.unilateral = true;
			else delete entry.unilateral;
			entry.notes = notesInput.value.trim() || undefined;
			this.editingIndex = null;
			this.save();
			this.renderList();
			if (typeChanged) this.propagateType(oldName, newName, currentType);
		});

		window.activeWindow.setTimeout(() => nameInput.focus(), 50);
	}

	private propagateType(oldName: string, newName: string, type: ExerciseType): void {
		if (!this.onTypeChanged) return;
		void this.onTypeChanged(oldName, type).then(
			(count) => new Notice(typeChangeNotice(newName, type, count)),
			(e) => new Notice(`Error updating templates: ${String(e)}`)
		);
	}

	private save(): void {
		this.onSave([...this.library]);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
