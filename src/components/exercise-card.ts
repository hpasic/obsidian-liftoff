import type { Exercise, WorkoutSet, LiftOffSettings } from "../types";
import type { LastExerciseData } from "../utils/history";
import { SetRow } from "./set-row";
import { TimerBlock } from "./timer-block";

export interface ExerciseCardCallbacks {
	onExerciseChanged: (exercise: Exercise) => void;
	onSetCompleted?: (set: WorkoutSet) => void;
}

interface SetRowLike {
	getSet(): WorkoutSet;
	destroy(): void;
}

export class ExerciseCard {
	private containerEl: HTMLElement;
	private setsContainerEl: HTMLElement;
	private setRows: SetRowLike[] = [];
	private timerBlock: TimerBlock | null = null;
	private expanded: boolean;

	constructor(
		parentEl: HTMLElement,
		private exercise: Exercise,
		private lastData: LastExerciseData | null,
		private settings: LiftOffSettings,
		private callbacks: ExerciseCardCallbacks
	) {
		this.expanded = true;
		this.containerEl = parentEl.createDiv({ cls: "ln-exercise-card" });
		this.setsContainerEl = null!;
		this.render();
	}

	private get isTimer(): boolean {
		return this.exercise.exerciseType === "timer";
	}

	private render(): void {
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

		if (this.isTimer) {
			headerRight.createSpan({
				cls: "ln-exercise-set-count",
				text: `\u23F1 ${this.exercise.intervals ?? this.settings.defaultWorkDuration}`,
			});
		} else {
			const completedCount = this.exercise.sets.filter((s) => s.completed).length;
			headerRight.createSpan({
				cls: "ln-exercise-set-count",
				text: `${completedCount}/${this.exercise.sets.length}`,
			});
		}

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

		// Toggle expand/collapse on header tap
		header.addEventListener("click", () => {
			this.expanded = !this.expanded;
			this.render();
		});

		if (!this.expanded) {
			this.containerEl.addClass("ln-exercise-collapsed");
			return;
		}

		if (this.isTimer) {
			this.renderTimer();
		} else {
			this.renderWeightSets();
		}
	}

	private renderTimer(): void {
		// Previous hint
		if (this.lastData && this.lastData.workSeconds !== undefined) {
			const w = this.formatTime(this.lastData.workSeconds);
			const r = this.formatTime(this.lastData.restSeconds ?? 0);
			const n = this.lastData.intervals ?? 0;
			this.containerEl.createDiv({
				cls: "ln-exercise-previous",
				text: `Previous: ${w} / ${r} \u00D7 ${n}`,
			});
		}

		const workSec = this.exercise.workSeconds ?? this.settings.defaultWorkDuration;
		const restSec = this.exercise.restSeconds ?? this.settings.defaultRestIntervalDuration;
		const intervals = this.exercise.intervals ?? 5;

		this.timerBlock = new TimerBlock(
			this.containerEl,
			workSec,
			restSec,
			intervals,
			{
				onCompleted: () => {
					this.callbacks.onSetCompleted?.({
						weight: 0, reps: 0, unit: this.settings.weightUnit, completed: true,
					});
				},
				onChanged: (w, r, n) => {
					this.exercise.workSeconds = w;
					this.exercise.restSeconds = r;
					this.exercise.intervals = n;
					this.callbacks.onExerciseChanged(this.exercise);
				},
			}
		);
	}

	private renderWeightSets(): void {
		// Column headers
		const colHeaders = this.containerEl.createDiv({ cls: "ln-set-row ln-set-header" });
		colHeaders.createSpan({ cls: "ln-set-number", text: "SET" });
		colHeaders.createSpan({ cls: "ln-set-input", text: this.settings.weightUnit.toUpperCase() });
		colHeaders.createSpan({ cls: "ln-set-input", text: "REPS" });
		colHeaders.createSpan({ cls: "ln-set-check", text: "" });

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
			this.callbacks.onExerciseChanged(this.exercise);
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
						this.callbacks.onExerciseChanged(this.exercise);
					},
					onSetCompleted: (updatedSet) => {
						this.exercise.sets[i] = updatedSet;
						this.callbacks.onExerciseChanged(this.exercise);
						if (updatedSet.completed) {
							this.callbacks.onSetCompleted?.(updatedSet);
						}
					},
				}
			);
			this.setRows.push(row);
		}
	}

	private formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${String(s).padStart(2, "0")}`;
	}

	expand(): void {
		this.expanded = true;
		this.render();
	}

	collapse(): void {
		this.expanded = false;
		this.render();
	}

	getExercise(): Exercise {
		if (this.isTimer && this.timerBlock) {
			const state = this.timerBlock.getState();
			return {
				name: this.exercise.name,
				exerciseType: "timer",
				workSeconds: state.workSeconds,
				restSeconds: state.restSeconds,
				intervals: state.intervals,
				sets: state.completed
					? Array.from({ length: state.intervals }, () => ({
						weight: 0, reps: 0, unit: this.settings.weightUnit, completed: true,
					}))
					: [],
			};
		}
		return {
			name: this.exercise.name,
			exerciseType: this.exercise.exerciseType,
			sets: this.setRows.map((r) => r.getSet()),
		};
	}

	destroy(): void {
		this.timerBlock?.destroy();
		this.containerEl.remove();
	}
}
