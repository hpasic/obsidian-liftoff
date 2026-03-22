import { App, Modal } from "obsidian";
import type { ExerciseLibraryEntry, ExerciseType } from "../types";

export class ExercisePickerModal extends Modal {
	private searchInput: HTMLInputElement;
	private resultsEl: HTMLElement;
	private onSelect: (name: string, exerciseType: ExerciseType) => void;
	private library: ExerciseLibraryEntry[];
	private recentNames: string[];

	constructor(
		app: App,
		library: ExerciseLibraryEntry[],
		recentNames: string[],
		onSelect: (name: string, exerciseType: ExerciseType) => void
	) {
		super(app);
		this.library = library;
		this.recentNames = recentNames;
		this.onSelect = onSelect;
		this.searchInput = null!;
		this.resultsEl = null!;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ln-exercise-picker");

		contentEl.createEl("h3", { text: "Add exercise" });

		this.searchInput = contentEl.createEl("input", {
			cls: "ln-exercise-search",
			attr: {
				type: "text",
				placeholder: "Search exercises...",
			},
		});

		this.resultsEl = contentEl.createDiv({ cls: "ln-exercise-results" });

		this.searchInput.addEventListener("input", () => {
			this.updateResults(this.searchInput.value);
		});

		setTimeout(() => this.searchInput.focus(), 50);

		this.updateResults("");
	}

	private updateResults(query: string): void {
		this.resultsEl.empty();

		const queryLower = query.toLowerCase().trim();

		let matches: ExerciseLibraryEntry[];
		if (queryLower === "") {
			const recentEntries = this.recentNames
				.map((name) => this.library.find((e) => e.name === name))
				.filter((e): e is ExerciseLibraryEntry => e !== undefined);
			const rest = this.library.filter((e) => !this.recentNames.includes(e.name));

			if (recentEntries.length > 0) {
				this.resultsEl.createDiv({
					cls: "ln-exercise-section-label",
					text: "Recent",
				});
				for (const entry of recentEntries) {
					this.addResultItem(entry);
				}
				this.resultsEl.createDiv({
					cls: "ln-exercise-section-label",
					text: "All",
				});
			}
			matches = rest;
		} else {
			matches = this.library.filter((e) =>
				e.name.toLowerCase().includes(queryLower)
			);
		}

		for (const entry of matches) {
			this.addResultItem(entry);
		}

		if (
			queryLower !== "" &&
			!this.library.some((e) => e.name.toLowerCase() === queryLower)
		) {
			this.addCreateItems(query.trim());
		}
	}

	private addResultItem(entry: ExerciseLibraryEntry): void {
		const item = this.resultsEl.createDiv({
			cls: "ln-exercise-result",
		});
		const label = entry.exerciseType === "timer"
			? `\u23F1 ${entry.name}`
			: entry.name;
		item.textContent = label;
		item.addEventListener("click", () => {
			this.onSelect(entry.name, entry.exerciseType ?? "weight");
			this.close();
		});
	}

	private addCreateItems(name: string): void {
		const weightEl = this.resultsEl.createDiv({
			cls: "ln-exercise-result ln-exercise-create",
			text: `+ Create "${name}"`,
		});
		weightEl.addEventListener("click", () => {
			this.onSelect(name, "weight");
			this.close();
		});

		const timerEl = this.resultsEl.createDiv({
			cls: "ln-exercise-result ln-exercise-create ln-exercise-create-timer",
			text: `\u23F1 Create "${name}" as timer`,
		});
		timerEl.addEventListener("click", () => {
			this.onSelect(name, "timer");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
