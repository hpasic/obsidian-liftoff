import { App, Modal } from "obsidian";
import type { ExerciseLibraryEntry, ExerciseType } from "../types";
import {
	getCatalog,
	getCatalogByName,
	getCatalogBodyParts,
	normalizeName,
	type CatalogExercise,
} from "../utils/exercise-catalog";
import { filterCatalog, filterLibrary, tokenizeQuery } from "../utils/exercise-search";

/** Catalog rows rendered at once. Beyond this the user is told to keep typing. */
const CATALOG_RENDER_CAP = 50;

export type ExerciseSource = "catalog";

export class ExercisePickerModal extends Modal {
	private searchInput: HTMLInputElement;
	private resultsEl: HTMLElement;
	private chipsEl: HTMLElement;
	private onSelect: (name: string, exerciseType: ExerciseType, source?: ExerciseSource) => void;
	private library: ExerciseLibraryEntry[];
	private recentNames: string[];
	private activeBodyPart: string | null = null;

	constructor(
		app: App,
		library: ExerciseLibraryEntry[],
		recentNames: string[],
		onSelect: (name: string, exerciseType: ExerciseType, source?: ExerciseSource) => void
	) {
		super(app);
		this.library = library;
		this.recentNames = recentNames;
		this.onSelect = onSelect;
		this.searchInput = null!;
		this.resultsEl = null!;
		this.chipsEl = null!;
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

		this.chipsEl = contentEl.createDiv({ cls: "ln-picker-chips" });
		this.renderChips();

		this.resultsEl = contentEl.createDiv({ cls: "ln-exercise-results" });

		this.searchInput.addEventListener("input", () => {
			this.updateResults(this.searchInput.value);
		});

		window.activeWindow.setTimeout(() => this.searchInput.focus({ preventScroll: true }), 50);

		this.updateResults("");
	}

	private renderChips(): void {
		this.chipsEl.empty();
		for (const bodyPart of getCatalogBodyParts()) {
			const chip = this.chipsEl.createDiv({ cls: "ln-picker-chip", text: bodyPart });
			chip.toggleClass("ln-picker-chip-active", this.activeBodyPart === bodyPart);
			chip.addEventListener("click", () => {
				this.activeBodyPart = this.activeBodyPart === bodyPart ? null : bodyPart;
				this.renderChips();
				this.updateResults(this.searchInput.value);
			});
		}
	}

	private updateResults(query: string): void {
		this.resultsEl.empty();

		const trimmed = query.trim();
		const tokens = tokenizeQuery(trimmed);
		const hasQuery = tokens.length > 0;

		if (hasQuery || this.activeBodyPart !== null) {
			this.renderFilteredResults(trimmed, tokens, hasQuery);
			return;
		}

		// Idle state: the user's own library only — the catalog stays out of the
		// way until they search or pick a body part.
		const recentEntries = this.recentNames
			.map((name) => this.library.find((e) => e.name === name))
			.filter((e): e is ExerciseLibraryEntry => e !== undefined);
		const rest = this.library.filter((e) => !this.recentNames.includes(e.name));

		if (recentEntries.length > 0) {
			this.addSectionLabel("Recent");
			for (const entry of recentEntries) this.addLibraryItem(entry);
			this.addSectionLabel("All");
		}
		for (const entry of rest) this.addLibraryItem(entry);
	}

	private renderFilteredResults(query: string, tokens: string[], hasQuery: boolean): void {
		const libraryMatches = filterLibrary(this.library, getCatalogByName(), {
			tokens,
			bodyPart: this.activeBodyPart,
		});

		if (libraryMatches.length > 0) {
			this.addSectionLabel("My library");
			for (const entry of libraryMatches) this.addLibraryItem(entry);
		}

		const { items, total } = filterCatalog(getCatalog(), {
			tokens,
			bodyPart: this.activeBodyPart,
			excludeNames: new Set(this.library.map((e) => normalizeName(e.name))),
			limit: CATALOG_RENDER_CAP,
		});

		this.addSectionLabel("Catalog");
		if (items.length === 0) {
			this.resultsEl.createDiv({ cls: "ln-picker-empty", text: "No catalog matches." });
		}
		for (const exercise of items) this.addCatalogItem(exercise);
		if (total > items.length) {
			this.resultsEl.createDiv({
				cls: "ln-picker-more",
				text: `+${total - items.length} more — keep typing to narrow down`,
			});
		}

		// Only the user's own library suppresses the create rows. A catalog name
		// match must not: "burpee" ships as a duration hold, and creating it as
		// an interval timer instead has to stay one tap away.
		const queryLower = normalizeName(query);
		const owned = this.library.some((e) => normalizeName(e.name) === queryLower);
		if (hasQuery && !owned) this.addCreateItems(query);
	}

	private addSectionLabel(text: string): void {
		this.resultsEl.createDiv({ cls: "ln-exercise-section-label", text });
	}

	private addLibraryItem(entry: ExerciseLibraryEntry): void {
		const item = this.resultsEl.createDiv({ cls: "ln-exercise-result" });
		let label: string;
		if (entry.exerciseType === "timer") label = `⏱ ${entry.name}`;
		else if (entry.exerciseType === "duration") label = `⏲ ${entry.name}`;
		else label = entry.name;
		item.textContent = label;
		item.addEventListener("click", () => {
			this.onSelect(entry.name, entry.exerciseType ?? "weight");
			this.close();
		});
	}

	private addCatalogItem(exercise: CatalogExercise): void {
		const item = this.resultsEl.createDiv({
			cls: "ln-exercise-result ln-catalog-result",
		});
		const prefix = exercise.exerciseType === "duration" ? "⏲ " : "";
		item.createDiv({ cls: "ln-catalog-name", text: `${prefix}${exercise.name}` });
		item.createDiv({
			cls: "ln-catalog-meta",
			text: `${exercise.target} · ${exercise.equipment}`,
		});
		item.addEventListener("click", () => {
			this.onSelect(exercise.name, exercise.exerciseType, "catalog");
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
			text: `⏱ Create "${name}" as timer`,
		});
		timerEl.addEventListener("click", () => {
			this.onSelect(name, "timer");
			this.close();
		});

		const durationEl = this.resultsEl.createDiv({
			cls: "ln-exercise-result ln-exercise-create ln-exercise-create-duration",
			text: `⏲ Create "${name}" as duration (max-hold)`,
		});
		durationEl.addEventListener("click", () => {
			this.onSelect(name, "duration");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
