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

	it("keeps rep-counted lifts on weight and never infers timer", () => {
		expect(deriveExerciseType("Barbell bench press", "chest")).toBe("weight");
		expect(deriveExerciseType("Dumbbell biceps curl", "upper arms")).toBe("weight");
		// "holding"/"planking" must not trip the whole-word hold match.
		expect(deriveExerciseType("Barbell holding row", "back")).toBe("weight");
	});
});
