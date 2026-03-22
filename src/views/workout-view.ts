import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type LiftOffPlugin from "../main";
import type { Workout, Exercise, ExerciseType } from "../types";
import type { WorkoutTemplate } from "../types";
import { ExerciseCard } from "../components/exercise-card";
import { ExercisePickerModal } from "../components/exercise-picker";
import { ConfirmModal } from "../components/modals";
import { TimerModal } from "./timer-view";
import { findLastSetsForExercise } from "../utils/history";

export const WORKOUT_VIEW_TYPE = "liftoff-workout";

export class WorkoutView extends ItemView {
	private plugin: LiftOffPlugin;
	private workout: Workout;
	private exerciseCards: ExerciseCard[] = [];
	private startTime: Date;
	private timerIntervalId: number | null = null;
	private restTimerIntervalId: number | null = null;
	private restStartTime: number | null = null;
	private restTimerEl: HTMLElement | null = null;
	private recentWorkouts: Workout[] = [];
	private initialized = false;

	constructor(leaf: WorkspaceLeaf, plugin: LiftOffPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.startTime = new Date();
		this.workout = this.createEmptyWorkout();
	}

	getViewType(): string {
		return WORKOUT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Liftoff - workout";
	}

	getIcon(): string {
		return "dumbbell";
	}

	private createEmptyWorkout(): Workout {
		const now = new Date();
		return {
			type: "workout",
			template: null,
			date: now.toISOString().split("T")[0]!,
			start: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
			end: null,
			duration: null,
			exercises: [],
		};
	}

	private lookupExerciseType(name: string): ExerciseType {
		const entry = this.plugin.settings.exerciseLibrary.find(
			(e) => e.name.toLowerCase() === name.toLowerCase()
		);
		return entry?.exerciseType ?? "weight";
	}

	async startFromTemplate(template: WorkoutTemplate): Promise<void> {
		this.initialized = true;
		this.workout = this.createEmptyWorkout();
		this.workout.template = template.name;
		this.workout.exercises = template.exercises.map((te) => {
			const exerciseType = te.exerciseType ?? this.lookupExerciseType(te.name);
			if (exerciseType === "timer") {
				return {
					name: te.name,
					exerciseType: "timer" as const,
					sets: [],
					workSeconds: this.plugin.settings.defaultWorkDuration,
					restSeconds: this.plugin.settings.defaultRestIntervalDuration,
					intervals: te.targetSets,
				};
			}
			return {
				name: te.name,
				exerciseType: exerciseType,
				sets: Array.from({ length: te.targetSets }, () => ({
					weight: 0,
					reps: 0,
					unit: this.plugin.settings.weightUnit,
					completed: false,
				})),
			};
		});
		this.startTime = new Date();
		this.loadRecentWorkouts();
		this.autoFillFromHistory();
		this.renderWorkout();
	}

	async startEmpty(): Promise<void> {
		this.initialized = true;
		this.workout = this.createEmptyWorkout();
		this.startTime = new Date();
		this.loadRecentWorkouts();
		this.renderWorkout();
	}

	private loadRecentWorkouts(): void {
		const recentMeta = this.plugin.workoutStore.getRecentWorkouts(20);
		const workouts: Workout[] = [];
		for (const meta of recentMeta) {
			const w = this.plugin.workoutStore.parseWorkoutFile(meta.path);
			if (w) workouts.push(w);
		}
		this.recentWorkouts = workouts;
	}

	private autoFillFromHistory(): void {
		for (const exercise of this.workout.exercises) {
			const lastData = findLastSetsForExercise(this.recentWorkouts, exercise.name);
			if (!lastData) continue;

			if (exercise.exerciseType === "timer") {
				if (lastData.workSeconds !== undefined) exercise.workSeconds = lastData.workSeconds;
				if (lastData.restSeconds !== undefined) exercise.restSeconds = lastData.restSeconds;
				if (lastData.intervals !== undefined) exercise.intervals = lastData.intervals;
			} else {
				for (let i = 0; i < exercise.sets.length; i++) {
					const prev = lastData.sets[i];
					if (prev) {
						exercise.sets[i]!.weight = prev.weight;
						exercise.sets[i]!.reps = prev.reps;
						exercise.sets[i]!.unit = prev.unit;
					}
				}
			}
		}
	}

	onOpen(): Promise<void> {
		// If not freshly started via startEmpty/startFromTemplate,
		// this is a workspace restoration — redirect to home.
		window.setTimeout(() => {
			if (!this.initialized) {
				void this.plugin.showHomeView();
			}
		}, 100);
		return Promise.resolve();
	}

	private renderWorkout(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("ln-workout-view");
		this.exerciseCards = [];

		// Header
		const header = container.createDiv({ cls: "ln-workout-header" });
		header.createSpan({
			cls: "ln-workout-title",
			text: this.workout.template ?? "Workout",
		});

		const headerRight = header.createDiv({ cls: "ln-workout-header-right" });
		const elapsedEl = headerRight.createSpan({ cls: "ln-workout-elapsed" });
		this.startElapsedTimer(elapsedEl);

		const timerBtn = headerRight.createEl("button", {
			cls: "ln-timer-icon-btn",
			text: "\u23F1",
		});
		timerBtn.addEventListener("click", () => {
			new TimerModal(this.app, this.plugin.settings).open();
		});

		// Rest timer (hidden until a set is completed)
		this.restTimerEl = container.createDiv({ cls: "ln-rest-timer ln-rest-timer-hidden" });
		this.restTimerEl.createSpan({ cls: "ln-rest-timer-label", text: "Rest" });
		this.restTimerEl.createSpan({ cls: "ln-rest-timer-value", text: "0:00" });
		const dismissBtn = this.restTimerEl.createEl("button", {
			cls: "ln-rest-timer-dismiss",
			text: "\u00D7",
		});
		dismissBtn.addEventListener("click", () => {
			this.stopRestTimer();
		});

		// Exercise cards
		const exercisesEl = container.createDiv({ cls: "ln-exercises" });
		for (const exercise of this.workout.exercises) {
			const lastData = findLastSetsForExercise(this.recentWorkouts, exercise.name);
			const card = new ExerciseCard(
				exercisesEl,
				exercise,
				lastData,
				this.plugin.settings,
				{
					onExerciseChanged: () => {},
					onSetCompleted: () => {
						this.startRestTimer();
					},
				}
			);
			this.exerciseCards.push(card);
		}

		// Bottom actions
		const actionsEl = container.createDiv({ cls: "ln-workout-actions" });

		const addExBtn = actionsEl.createEl("button", {
			cls: "ln-add-exercise-btn",
			text: "+ add exercise",
		});
		addExBtn.addEventListener("click", () => {
			this.openExercisePicker();
		});

		const finishBtn = actionsEl.createEl("button", {
			cls: "ln-finish-btn",
			text: "Finish workout",
		});
		finishBtn.addEventListener("click", () => {
			void this.finishWorkout();
		});
	}

	private startElapsedTimer(el: HTMLElement): void {
		if (this.timerIntervalId !== null) {
			window.clearInterval(this.timerIntervalId);
		}
		const update = () => {
			const elapsed = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
			const m = Math.floor(elapsed / 60);
			const s = elapsed % 60;
			el.textContent = `${m}:${String(s).padStart(2, "0")}`;
		};
		update();
		this.timerIntervalId = window.setInterval(update, 1000);
		this.register(() => {
			if (this.timerIntervalId !== null) {
				window.clearInterval(this.timerIntervalId);
			}
		});
	}

	private startRestTimer(): void {
		if (this.restTimerIntervalId !== null) {
			window.clearInterval(this.restTimerIntervalId);
		}

		this.restStartTime = Date.now();

		if (this.restTimerEl) {
			this.restTimerEl.removeClass("ln-rest-timer-hidden");
			const valueEl = this.restTimerEl.querySelector(".ln-rest-timer-value") as HTMLElement;
			if (valueEl) valueEl.textContent = "0:00";
		}

		this.restTimerIntervalId = window.setInterval(() => {
			if (!this.restStartTime || !this.restTimerEl) return;
			const elapsed = Math.floor((Date.now() - this.restStartTime) / 1000);
			const m = Math.floor(elapsed / 60);
			const s = elapsed % 60;
			const valueEl = this.restTimerEl.querySelector(".ln-rest-timer-value") as HTMLElement;
			if (valueEl) valueEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
		}, 1000);
	}

	private stopRestTimer(): void {
		if (this.restTimerIntervalId !== null) {
			window.clearInterval(this.restTimerIntervalId);
			this.restTimerIntervalId = null;
		}
		this.restStartTime = null;
		if (this.restTimerEl) {
			this.restTimerEl.addClass("ln-rest-timer-hidden");
		}
	}

	private openExercisePicker(): void {
		const recentNames = this.recentWorkouts
			.flatMap((w) => w.exercises.map((e) => e.name))
			.filter((name, i, arr) => arr.indexOf(name) === i)
			.slice(0, 10);

		new ExercisePickerModal(
			this.app,
			this.plugin.settings.exerciseLibrary,
			recentNames,
			(name, exerciseType) => {
				this.addExercise(name, exerciseType);
			}
		).open();
	}

	private addExercise(name: string, exerciseType: ExerciseType): void {
		const existing = this.plugin.settings.exerciseLibrary.find((e) => e.name === name);
		if (!existing) {
			this.plugin.settings.exerciseLibrary.push({ name, exerciseType });
			void this.plugin.saveSettings();
		} else if (!existing.exerciseType && exerciseType === "timer") {
			existing.exerciseType = exerciseType;
			void this.plugin.saveSettings();
		}

		const isTimer = exerciseType === "timer";
		const lastData = findLastSetsForExercise(this.recentWorkouts, name);

		let newExercise: Exercise;
		if (isTimer) {
			newExercise = {
				name,
				exerciseType,
				sets: [],
				workSeconds: lastData?.workSeconds ?? this.plugin.settings.defaultWorkDuration,
				restSeconds: lastData?.restSeconds ?? this.plugin.settings.defaultRestIntervalDuration,
				intervals: lastData?.intervals ?? 5,
			};
		} else {
			newExercise = {
				name,
				exerciseType,
				sets: [
					{
						weight: 0,
						reps: 0,
						unit: this.plugin.settings.weightUnit,
						completed: false,
					},
				],
			};
			if (lastData && lastData.sets.length > 0) {
				newExercise.sets = lastData.sets.map((s) => ({
					...s,
					completed: false,
				}));
			}
		}

		this.workout.exercises.push(newExercise);
		this.renderWorkout();
	}

	private async finishWorkout(): Promise<void> {
		const confirmed = await new ConfirmModal(this.app, "Finish and save this workout?").openAndWait();
		if (!confirmed) return;

		this.workout.exercises = this.exerciseCards.map((c) => c.getExercise());

		this.workout.exercises = this.workout.exercises.filter(
			(e) => e.sets.some((s) => s.completed)
		);

		if (this.workout.exercises.length === 0) {
			new Notice("No completed sets to save.");
			return;
		}

		const now = new Date();
		this.workout.end = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		this.workout.duration = Math.round((now.getTime() - this.startTime.getTime()) / 60000);

		for (const exercise of this.workout.exercises) {
			exercise.sets = exercise.sets.filter((s) => s.completed);
		}

		try {
			await this.plugin.workoutStore.saveWorkout(this.workout);
			new Notice("Workout saved!");
			void this.plugin.showHomeView();
		} catch (e) {
			new Notice(`Error saving workout: ${String(e)}`);
		}
	}

	onClose(): Promise<void> {
		if (this.timerIntervalId !== null) {
			window.clearInterval(this.timerIntervalId);
		}
		this.stopRestTimer();
		return Promise.resolve();
	}
}
