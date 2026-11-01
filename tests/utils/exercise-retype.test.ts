import { describe, expect, it } from "vitest";
import {
	retypeExercise,
	retypeTemplateEntries,
	setLibraryExerciseType,
	typeChangeNotice,
} from "../../src/utils/exercise-retype";
import type { Exercise, ExerciseLibraryEntry } from "../../src/types";

describe("retypeTemplateEntries", () => {
	it("retypes every same-name entry case-insensitively and reports a change", () => {
		const core = [{ name: "plank", targetSets: 3, tags: "x" }, { name: "Crunch", targetSets: 3 }];
		expect(retypeTemplateEntries(core, "Plank", "duration")).toBe(true);
		expect(core).toEqual([
			{ name: "plank", targetSets: 3, tags: "x", exerciseType: "duration" },
			{ name: "Crunch", targetSets: 3 },
		]);
		expect(retypeTemplateEntries([{ name: "PLANK", exerciseType: "duration" }], "Plank", "duration")).toBe(false);
		expect(retypeTemplateEntries([{ name: "Squat" }, null, "junk"], "Plank", "duration")).toBe(false);
		expect(retypeTemplateEntries(undefined, "Plank", "duration")).toBe(false);
	});

	it("writes weight explicitly so it overrides the library", () => {
		const core: Record<string, unknown>[] = [{ name: "Plank", targetSets: 3 }];
		expect(retypeTemplateEntries(core, "Plank", "weight")).toBe(true);
		expect(core[0]!.exerciseType).toBe("weight");
	});
});

describe("setLibraryExerciseType", () => {
	it("updates a case-insensitive match, storing weight as absent, or adds the entry", () => {
		const library: ExerciseLibraryEntry[] = [{ name: "plank", exerciseType: "duration", notes: "core" }];
		setLibraryExerciseType(library, "Plank", "weight");
		expect(library).toEqual([{ name: "plank", exerciseType: undefined, notes: "core" }]);
		setLibraryExerciseType(library, "Tabata", "timer");
		expect(library[1]).toEqual({ name: "Tabata", exerciseType: "timer" });
	});
});

describe("retypeExercise", () => {
	it("drops completed sets, keeps open sets' weight and clears timer config", () => {
		const ex: Exercise = {
			name: "Plank", exerciseType: "weight", note: "slow",
			sets: [
				{ weight: 20, reps: 5, unit: "lbs", completed: true },
				{ weight: 10, reps: 5, unit: "lbs", completed: false, setType: "warmup" },
			],
		};
		retypeExercise(ex, "duration", "kg");
		expect(ex).toEqual({
			name: "Plank", exerciseType: "duration", note: "slow",
			sets: [{ weight: 10, reps: 0, unit: "lbs", completed: false, durationSeconds: 0 }],
		});
	});

	it("seeds one blank row from a timer and none for a timer", () => {
		const ex: Exercise = { name: "T", exerciseType: "timer", sets: [], workSeconds: 30, restSeconds: 10, transitionSeconds: 5, intervals: 8 };
		retypeExercise(ex, "weight", "kg");
		expect(ex).toEqual({ name: "T", exerciseType: "weight", sets: [{ weight: 0, reps: 0, unit: "kg", completed: false }] });
		retypeExercise(ex, "timer", "kg");
		expect(ex).toEqual({ name: "T", exerciseType: "timer", sets: [] });
	});
});

describe("typeChangeNotice", () => {
	it("mentions the updated template count", () => {
		expect(typeChangeNotice("Plank", "duration", 2)).toBe("\"Plank\" is now a duration exercise. Updated 2 templates.");
		expect(typeChangeNotice("Plank", "timer", 1)).toBe("\"Plank\" is now a timer exercise. Updated 1 template.");
		expect(typeChangeNotice("Plank", "weight", 0)).toBe("\"Plank\" is now a weight exercise. No templates needed updating.");
	});
});
