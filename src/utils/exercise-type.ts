import type { ExerciseType } from "../types";

/**
 * Names that describe a static hold rather than a rep-counted lift. Matched as
 * whole words so "holding" or "planking" style variants do not sneak in.
 */
const HOLD_NAME_PATTERN = /\b(stretch|plank|wall sit|hold)\b/i;

/**
 * Catalog rows carry no exercise type, so we infer one from the dataset fields.
 * Cardio and static holds become count-up "duration" exercises; everything else
 * is a weight exercise. "timer" (interval) is never inferred — it is a
 * deliberate user choice.
 */
export function deriveExerciseType(name: string, bodyPart: string): ExerciseType {
	if (bodyPart.trim().toLowerCase() === "cardio") return "duration";
	return HOLD_NAME_PATTERN.test(name) ? "duration" : "weight";
}
