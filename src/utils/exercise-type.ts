import type { ExerciseType } from "../types";

/**
 * Rep-counted movements. Checked first, so a hold word elsewhere in the name
 * loses: "weighted stretch lunge" and "handstand push-up" are lifts, and
 * "front lever reps" says so outright.
 */
const REP_NAME_PATTERN =
	/\b(push-?ups?|presses|press|curls?|rows?|fl(?:y|ies|yes)|raises?|lunges?|cleans?|squats?|extensions?|marche?s?|climbers?|reps?)\b/i;

/**
 * Static holds. Whole-word matches, so "holding" and the 70-odd machine rows
 * starting with "Lever" stay out — only the front/back lever calisthenics
 * holds qualify.
 */
const HOLD_NAME_PATTERN =
	/\b(stretch|plank|wall sit|hold|handstand|isometric|l-?sit|carry|carries|flag|farmers walk)\b|\b(?:front|back) lever\b/i;

/**
 * Held positions whose names read like any other floor exercise — the dataset
 * has a dozen "bridge" rows and only these two are holds.
 */
const HOLD_NAMES = new Set(["rear decline bridge", "side bridge v. 2"]);

/**
 * Catalog rows carry no exercise type, so we infer one from the dataset fields.
 * Cardio and static holds become count-up "duration" exercises; everything else
 * is a weight exercise. "timer" (interval) is never inferred — it is a
 * deliberate user choice.
 */
export function deriveExerciseType(name: string, bodyPart: string): ExerciseType {
	if (bodyPart.trim().toLowerCase() === "cardio") return "duration";
	const normalized = name.trim().toLowerCase();
	if (HOLD_NAMES.has(normalized)) return "duration";
	if (REP_NAME_PATTERN.test(normalized)) return "weight";
	return HOLD_NAME_PATTERN.test(normalized) ? "duration" : "weight";
}
