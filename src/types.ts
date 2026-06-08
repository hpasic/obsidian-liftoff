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
}

export interface LiftOffSettings {
	workoutFolder: string;
	templateFolder: string;
	weightUnit: "kg" | "lbs";
	restTimerPresets: number[]; // seconds
	defaultRestDuration: number; // seconds
	defaultWorkDuration: number; // seconds, for timer exercises
	defaultRestIntervalDuration: number; // seconds, for timer exercises
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
	exerciseLibrary: [],
};
