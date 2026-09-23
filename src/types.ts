export type ExerciseType = "weight" | "timer" | "duration";

export type SetType = "warmup" | "working" | "drop" | "failure";

export interface WorkoutSet {
	weight: number;
	reps: number;
	unit: "kg" | "lbs";
	completed: boolean;
	setType?: SetType;
	/** For duration-type exercises: elapsed seconds the user held. */
	durationSeconds?: number;
}

export interface Exercise {
	name: string;
	exerciseType?: ExerciseType;
	sets: WorkoutSet[];
	/** Free-text note for this exercise in this workout. */
	note?: string;
	// Timer-specific (only used when exerciseType === "timer")
	workSeconds?: number;
	restSeconds?: number;
	transitionSeconds?: number;
	intervals?: number;
}

export interface Workout {
	type: "workout";
	template: string | null;
	date: string; // YYYY-MM-DD
	start: string; // HH:mm
	end: string | null; // HH:mm
	duration: number | null; // minutes
	exercises: Exercise[];
}

export interface TemplateExercise {
	name: string;
	targetSets: number;
	exerciseType?: ExerciseType;
}

export interface WorkoutTemplate {
	type: "workout-template";
	name: string;
	exercises: TemplateExercise[];
}

export interface ActiveWorkout {
	workout: Workout;
	startTimeMs: number;
}

export interface ExerciseLibraryEntry {
	name: string;
	exerciseType?: ExerciseType;
	notes?: string;
	/** Set when the entry was copied in from the bundled catalog. Absent = user-created. */
	source?: "catalog";
}

export interface LiftOffSettings {
	workoutFolder: string;
	templateFolder: string;
	weightUnit: "kg" | "lbs";
	restTimerPresets: number[]; // seconds
	defaultRestDuration: number; // seconds
	defaultWorkDuration: number; // seconds, for timer exercises
	defaultRestIntervalDuration: number; // seconds, for timer exercises
	/** Seconds to get into and out of a hold: a count-down before the clock, subtracted after. 0 disables. */
	holdBufferSeconds: number;
	/** Keep the screen on while any timer, hold, or rest timer is running. */
	keepScreenAwake: boolean;
	exerciseLibrary: ExerciseLibraryEntry[];
}

export const DEFAULT_SETTINGS: LiftOffSettings = {
	workoutFolder: "Workouts",
	templateFolder: "Workout Templates",
	weightUnit: "kg",
	restTimerPresets: [30, 60, 90, 120],
	defaultRestDuration: 90,
	defaultWorkDuration: 40,
	defaultRestIntervalDuration: 20,
	holdBufferSeconds: 5,
	keepScreenAwake: true,
	exerciseLibrary: [],
};
