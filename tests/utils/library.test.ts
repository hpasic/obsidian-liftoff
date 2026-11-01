import { describe, expect, it } from "vitest";
import { addTemplateExercisesToLibrary } from "../../src/utils/library";
import type { ExerciseLibraryEntry } from "../../src/types";

describe("addTemplateExercisesToLibrary", () => {
	it("records catalog picks as catalog entries and leaves custom ones sourceless", () => {
		const library: ExerciseLibraryEntry[] = [];
		addTemplateExercisesToLibrary(library, [
			{ name: "Front plank with twist", targetSets: 3, exerciseType: "duration" },
			{ name: "My row", targetSets: 3 },
		], new Set(["front plank with twist"]));
		expect(library).toEqual([
			{ name: "Front plank with twist", exerciseType: "duration", source: "catalog" },
			{ name: "My row", exerciseType: undefined, source: undefined },
		]);
		expect(JSON.parse(JSON.stringify(library))[1]).toEqual({ name: "My row" });
	});

	it("never changes an existing entry's source, as in the workout view", () => {
		const library: ExerciseLibraryEntry[] = [
			{ name: "barbell bench press" },
			{ name: "Burpee", exerciseType: "duration", source: "catalog" },
		];
		addTemplateExercisesToLibrary(library, [
			{ name: "Barbell bench press", targetSets: 3 },
			{ name: "Burpee", targetSets: 3, exerciseType: "timer" },
		], new Set(["barbell bench press"]));
		expect(library).toEqual([
			{ name: "barbell bench press" },
			{ name: "Burpee", exerciseType: "duration", source: "catalog" },
		]);
	});

	it("never copies a template's unilateral flag into the library", () => {
		const library: ExerciseLibraryEntry[] = [{ name: "Bulgarian split squat" }];
		addTemplateExercisesToLibrary(library, [
			{ name: "Bulgarian split squat", targetSets: 3, unilateral: true },
			{ name: "Walking Lunge", targetSets: 3, unilateral: true },
			{ name: "Squat", targetSets: 3 },
		], new Set());
		expect(JSON.parse(JSON.stringify(library))).toEqual([
			{ name: "Bulgarian split squat" },
			{ name: "Walking Lunge" },
			{ name: "Squat" },
		]);
	});
});
