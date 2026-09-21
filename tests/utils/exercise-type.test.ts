import { describe, expect, it } from "vitest";
import { deriveExerciseType } from "../../src/utils/exercise-type";

describe("deriveExerciseType", () => {
	it("treats cardio as a duration exercise regardless of name", () => {
		expect(deriveExerciseType("Stationary bike run v.3", "cardio")).toBe("duration");
		expect(deriveExerciseType("Burpee", "cardio")).toBe("duration");
	});

	it("treats holds and stretches as duration exercises", () => {
		expect(deriveExerciseType("Front plank with twist", "waist")).toBe("duration");
		expect(deriveExerciseType("Assisted lying calves stretch", "lower legs")).toBe("duration");
		expect(deriveExerciseType("Wall sit", "upper legs")).toBe("duration");
		expect(deriveExerciseType("Dumbbell fix finger hold", "lower arms")).toBe("duration");
	});

	it("classifies held positions the hold words miss", () => {
		expect(deriveExerciseType("L-sit on floor", "waist")).toBe("duration");
		expect(deriveExerciseType("Handstand", "shoulders")).toBe("duration");
		expect(deriveExerciseType("Front lever", "back")).toBe("duration");
		expect(deriveExerciseType("Back lever", "back")).toBe("duration");
		expect(deriveExerciseType("Flag", "waist")).toBe("duration");
		expect(deriveExerciseType("Farmers walk", "forearms")).toBe("duration");
		expect(deriveExerciseType("Dumbbell single arm overhead carry", "waist")).toBe("duration");
		expect(deriveExerciseType("Isometric chest squeeze", "chest")).toBe("duration");
		expect(deriveExerciseType("Isometric wipers", "chest")).toBe("duration");
		expect(deriveExerciseType("Rear decline bridge", "back")).toBe("duration");
		expect(deriveExerciseType("Side bridge v. 2", "waist")).toBe("duration");
	});

	it("lets a rep movement outrank a hold word in the same name", () => {
		expect(deriveExerciseType("Weighted stretch lunge", "upper legs")).toBe("weight");
		expect(deriveExerciseType("Dumbbell side plank with rear fly", "waist")).toBe("weight");
		expect(deriveExerciseType("Handstand push-up", "shoulders")).toBe("weight");
		expect(deriveExerciseType("Front lever reps", "back")).toBe("weight");
	});

	it("leaves the machine rows named 'Lever …' alone", () => {
		expect(deriveExerciseType("Lever chest press", "chest")).toBe("weight");
		expect(deriveExerciseType("Lever deadlift", "upper legs")).toBe("weight");
	});

	it("keeps rep-counted lifts on weight and never infers timer", () => {
		expect(deriveExerciseType("Barbell bench press", "chest")).toBe("weight");
		expect(deriveExerciseType("Dumbbell biceps curl", "upper arms")).toBe("weight");
		// "holding"/"planking" must not trip the whole-word hold match.
		expect(deriveExerciseType("Barbell holding row", "back")).toBe("weight");
	});
});
