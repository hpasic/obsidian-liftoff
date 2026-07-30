import { Menu } from "obsidian";
import type { Exercise, WorkoutSet, LiftOffSettings } from "../types";
import type { LastExerciseData } from "../utils/history";
import { applyToBests, detectPRs, type PRBests, type PRKind } from "../utils/sets";
import { DurationSetRow } from "./duration-set-row";
import { SetRow } from "./set-row";
import { TimerBlock } from "./timer-block";

export interface ExerciseCardCallbacks {
	onExerciseChanged: (exercise: Exercise) => void;
	onSetCompleted?: (set: WorkoutSet) => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
	// Cards outlive their position (reorder moves them, it does not rebuild them),
	// so the menu asks at click time whether the move is still possible
	canMoveUp?: () => boolean;
	canMoveDown?: () => boolean;
	onRemove?: () => void;
}

interface SetRowLike {
	destroy(): void;
}

export class ExerciseCard {
	private containerEl: HTMLElement;
	private setsContainerEl: HTMLElement;
	private setCountEl: HTMLElement | null = null;
	private setRows: SetRowLike[] = [];
	private timerBlock: TimerBlock | null = null;
	private expanded: boolean;
	private historyBests: PRBests;
	private bests: PRBests;
	private prKindsByIndex: Map<number, PRKind[]> = new Map();

	constructor(
		parentEl: HTMLElement,
		private exercise: Exercise,
		private lastData: LastExerciseData | null,
		private settings: LiftOffSettings,
		bests: PRBests,
		private callbacks: ExerciseCardCallbacks
	) {
		this.historyBests = { ...bests };
		this.bests = { ...bests };
		this.expanded = true;
		this.containerEl = parentEl.createDiv({ cls: "ln-exercise-card" });
		this.setsContainerEl = null!;
		this.render();
	}

	private get isTimer(): boolean {
		return this.exercise.exerciseType === "timer";
	}

	private get isDuration(): boolean {
		return this.exercise.exerciseType === "duration";
	}

	private render(): void {
		for (const row of this.setRows) row.destroy();
		this.timerBlock?.destroy();
		this.containerEl.empty();
		this.setRows = [];
		this.timerBlock = null;

		// Header
		const header = this.containerEl.createDiv({ cls: "ln-exercise-header" });
		header.createSpan({
			cls: "ln-exercise-name",
			text: this.exercise.name,
		});

		const headerRight = header.createDiv({ cls: "ln-exercise-header-right" });
		if (this.lastData) {
			headerRight.createSpan({
				cls: "ln-exercise-last-date",
				text: `Last: ${this.lastData.date}`,
			});
		}

		this.setCountEl = headerRight.createSpan({ cls: "ln-exercise-set-count" });
		this.updateSetCount();

		this.renderMenuButton(headerRight);

		// Exercise notes
		const libraryEntry = this.settings.exerciseLibrary.find(
			(e) => e.name.toLowerCase() === this.exercise.name.toLowerCase()
		);
		if (libraryEntry?.notes) {
			this.containerEl.createDiv({
				cls: "ln-exercise-notes",
				text: libraryEntry.notes,
			});
		}

		// Toggle expand/collapse on header tap. Visibility-only (CSS class):
		// re-rendering here would destroy a running timer or in-progress hold.
		header.addEventListener("click", () => {
			this.setExpanded(!this.expanded);
		});

		this.containerEl.toggleClass("ln-exercise-collapsed", !this.expanded);

		this.renderNoteField();

		if (this.isTimer) {
			this.renderTimer();
		} else if (this.isDuration) {
			this.renderDurationSets();
		} else {
			this.renderWeightSets();
		}
	}

	private renderMenuButton(parentEl: HTMLElement): void {
		const { onMoveUp, onMoveDown, onRemove } = this.callbacks;
		if (!onMoveUp && !onMoveDown && !onRemove) return;

		const menuBtn = parentEl.createEl("button", {
			cls: "ln-exercise-menu-btn",
			text: "\u22EE",
			attr: { "aria-label": "Exercise options" },
		});
		menuBtn.addEventListener("click", (evt) => {
			// Header click toggles collapse — keep it off the menu button
			evt.stopPropagation();

			const menu = new Menu();
			if (onMoveUp && (this.callbacks.canMoveUp?.() ?? true)) {
				menu.addItem((item) =>
					item.setTitle("Move up").setIcon("arrow-up").onClick(() => onMoveUp())
				);
			}
			if (onMoveDown && (this.callbacks.canMoveDown?.() ?? true)) {
				menu.addItem((item) =>
					item.setTitle("Move down").setIcon("arrow-down").onClick(() => onMoveDown())
				);
			}
			if (onRemove) {
				menu.addItem((item) =>
					item.setTitle("Remove exercise").setIcon("trash-2").onClick(() => onRemove())
				);
			}
			menu.showAtMouseEvent(evt);
		});
	}

	private renderNoteField(): void {
		const noteEl = this.containerEl.createEl("textarea", {
			cls: "ln-exercise-note-input",
			attr: { placeholder: "Add a note…", rows: "1" },
		});
		noteEl.value = this.exercise.note ?? "";
		const autoGrow = () => {
			// Drive height via a CSS var the stylesheet consumes (Obsidian forbids
			// direct el.style assignment). Set to auto first so scrollHeight reflows
			// to the content height, then pin to it.
			noteEl.setCssProps({ "--ln-note-height": "auto" });
			noteEl.setCssProps({ "--ln-note-height": `${noteEl.scrollHeight}px` });
		};
		noteEl.addEventListener("input", () => {
			this.exercise.note = noteEl.value;
			autoGrow();
			this.notifyChanged();
		});
		autoGrow();
	}

	private renderDurationSets(): void {
		// Previous hint (longest hold in last session)
		let prevBest: number | null = null;
		if (this.lastData && this.lastData.sets.length > 0) {
			for (const s of this.lastData.sets) {
				const d = s.durationSeconds ?? 0;
				if (d > (prevBest ?? 0)) prevBest = d;
			}
		}

		this.setsContainerEl = this.containerEl.createDiv({ cls: "ln-sets-container" });

		for (let i = 0; i < this.exercise.sets.length; i++) {
			const set = this.exercise.sets[i]!;
			const previousSet = this.lastData?.sets[i];
			const prev = previousSet?.durationSeconds ?? prevBest;

			const row = new DurationSetRow(
				this.setsContainerEl,
				i + 1,
				set,
				prev ?? null,
				{
					onSetChanged: (updatedSet) => {
						this.exercise.sets[i] = updatedSet;
						this.notifyChanged();
					},
					onSetCompleted: (updatedSet) => {
						this.exercise.sets[i] = updatedSet;
						this.notifyChanged();
						this.callbacks.onSetCompleted?.(updatedSet);
					},
					onSetRemoved: () => {
						this.exercise.sets.splice(i, 1);
						this.render();
						this.notifyChanged();
					},
				}
			);
			this.setRows.push(row);
		}

		const addSetBtn = this.containerEl.createDiv({
			cls: "ln-add-set-btn",
			text: "+ Add hold",
		});
		addSetBtn.addEventListener("click", () => {
			this.exercise.sets.push({
				weight: 0,
				reps: 0,
				unit: this.settings.weightUnit,
				completed: false,
				durationSeconds: 0,
			});
			this.render();
			this.notifyChanged();
		});
	}

	private renderTimer(): void {
		// Previous hint
		if (this.lastData && this.lastData.workSeconds !== undefined) {
			const w = this.formatTime(this.lastData.workSeconds);
			const r = this.formatTime(this.lastData.restSeconds ?? 0);
			const t = this.lastData.transitionSeconds ?? 0;
			const n = this.lastData.intervals ?? 0;
			this.containerEl.createDiv({
				cls: "ln-exercise-previous",
				text: `Previous: ${w} / ${r}${t > 0 ? ` / ${this.formatTime(t)}` : ""} \u00D7 ${n}`,
			});
		}

		const workSec = this.exercise.workSeconds ?? this.settings.defaultWorkDuration;
		const restSec = this.exercise.restSeconds ?? this.settings.defaultRestIntervalDuration;
		const transitionSec = this.exercise.transitionSeconds ?? 0;
		const intervals = this.exercise.intervals ?? 5;

		// Resolved defaults are the exercise's state from now on — getExercise()
		// reads them straight off the exercise, not off the timer block
		this.exercise.workSeconds = workSec;
		this.exercise.restSeconds = restSec;
		this.exercise.transitionSeconds = transitionSec;
		this.exercise.intervals = intervals;

		const wasCompleted =
			this.exercise.sets.length > 0 && this.exercise.sets.every((s) => s.completed);

		this.timerBlock = new TimerBlock(
			this.containerEl,
			workSec,
			restSec,
			transitionSec,
			intervals,
			{
				onCompleted: () => {
					const count = this.timerBlock?.getState().intervals ?? intervals;
					this.exercise.sets = Array.from({ length: count }, () => ({
						weight: 0, reps: 0, unit: this.settings.weightUnit, completed: true,
					}));
					this.notifyChanged();
					this.callbacks.onSetCompleted?.({
						weight: 0, reps: 0, unit: this.settings.weightUnit, completed: true,
					});
				},
				onChanged: (w, r, t, n) => {
					this.exercise.workSeconds = w;
					this.exercise.restSeconds = r;
					this.exercise.transitionSeconds = t;
					this.exercise.intervals = n;
					this.notifyChanged();
				},
				onReset: () => {
					this.exercise.sets = [];
					this.notifyChanged();
				},
			},
			wasCompleted
		);
	}

	private renderWeightSets(): void {
		// Column headers
		const colHeaders = this.containerEl.createDiv({ cls: "ln-set-row ln-set-header" });
		colHeaders.createSpan({ cls: "ln-set-number", text: "SET" });
		colHeaders.createSpan({ cls: "ln-set-input", text: this.settings.weightUnit.toUpperCase() });
		colHeaders.createSpan({ cls: "ln-set-input", text: "REPS" });

		// Previous hint
		if (this.lastData && this.lastData.sets.length > 0) {
			const lastSet = this.lastData.sets[this.lastData.sets.length - 1]!;
			this.containerEl.createDiv({
				cls: "ln-exercise-previous",
				text: `Previous: ${lastSet.weight} x ${lastSet.reps}`,
			});
		}

		// Sets container
		this.setsContainerEl = this.containerEl.createDiv({ cls: "ln-sets-container" });
		this.renderSets();

		// Add Set button
		const addSetBtn = this.containerEl.createDiv({
			cls: "ln-add-set-btn",
			text: "+ Add Set",
		});
		addSetBtn.addEventListener("click", () => {
			const lastSet = this.exercise.sets[this.exercise.sets.length - 1];
			const newSet: WorkoutSet = {
				weight: lastSet?.weight ?? 0,
				reps: 0,
				unit: this.settings.weightUnit,
				completed: false,
			};
			this.exercise.sets.push(newSet);
			this.render();
			this.notifyChanged();
		});
	}

	private renderSets(): void {
		this.setsContainerEl.empty();
		this.setRows = [];

		for (let i = 0; i < this.exercise.sets.length; i++) {
			const set = this.exercise.sets[i]!;
			const previousSet = this.lastData?.sets[i];
			const hint = previousSet
				? `${previousSet.weight} x ${previousSet.reps}`
				: null;

			const row = new SetRow(
				this.setsContainerEl,
				i + 1,
				set,
				hint,
				{
					onSetChanged: (updatedSet) => {
						this.exercise.sets[i] = updatedSet;
						this.notifyChanged();
					},
					onSetCompleted: (updatedSet) => {
						this.exercise.sets[i] = updatedSet;
						this.notifyChanged();
						if (updatedSet.completed) {
							const prs = detectPRs(updatedSet, this.bests);
							if (prs.length > 0) {
								this.prKindsByIndex.set(i, prs);
								row.showPR(prs);
								applyToBests(updatedSet, this.bests);
							}
							this.callbacks.onSetCompleted?.(updatedSet);
						} else {
							// Unchecked — clear any badge for this row and roll
							// back the absorbed best so re-checking can PR again
							this.prKindsByIndex.delete(i);
							row.clearPR();
							this.recomputeBests();
						}
					},
					onSetRemoved: () => {
						this.exercise.sets.splice(i, 1);
						this.shiftPrKindsForRemoval(i);
						this.render();
						this.notifyChanged();
					},
				}
			);
			this.setRows.push(row);

			const existingPr = this.prKindsByIndex.get(i);
			if (existingPr && existingPr.length > 0) {
				row.showPR(existingPr);
			}
		}
	}

	private shiftPrKindsForRemoval(removedIndex: number): void {
		const next: Map<number, PRKind[]> = new Map();
		for (const [idx, kinds] of this.prKindsByIndex) {
			if (idx < removedIndex) next.set(idx, kinds);
			else if (idx > removedIndex) next.set(idx - 1, kinds);
			// idx === removedIndex is dropped
		}
		this.prKindsByIndex = next;
	}

	/**
	 * Rebuild live bests from the immutable history snapshot plus every set
	 * still marked completed. Called when a set is unchecked so its absorbed
	 * best is rolled back and re-checking it can register the PR again.
	 */
	private recomputeBests(): void {
		this.bests = { ...this.historyBests };
		for (const set of this.exercise.sets) {
			if (set.completed) applyToBests(set, this.bests);
		}
	}

	/** Single choke point for data changes: keeps the header count live. */
	private notifyChanged(): void {
		this.updateSetCount();
		this.callbacks.onExerciseChanged(this.exercise);
	}

	private updateSetCount(): void {
		if (!this.setCountEl) return;
		if (this.isTimer) {
			this.setCountEl.textContent = `⏱ ${this.exercise.intervals ?? 5}`;
		} else {
			const completedCount = this.exercise.sets.filter((s) => s.completed).length;
			const prefix = this.isDuration ? "⏱ " : "";
			this.setCountEl.textContent = `${prefix}${completedCount}/${this.exercise.sets.length}`;
		}
	}

	private formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	}

	private setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.containerEl.toggleClass("ln-exercise-collapsed", !expanded);
	}

	getRootEl(): HTMLElement {
		return this.containerEl;
	}

	/**
	 * The exercise object is the single source of truth: set rows and the timer
	 * block write straight into it, so a collapsed card (which renders no rows)
	 * still reports its real sets.
	 */
	getExercise(): Exercise {
		return this.exercise;
	}

	destroy(): void {
		this.timerBlock?.destroy();
		for (const row of this.setRows) row.destroy();
		this.containerEl.remove();
	}
}
