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

	it("gives an existing sourceless entry the catalog source, never takes one away", () => {
		const library: ExerciseLibraryEntry[] = [
			{ name: "barbell bench press" },
			{ name: "Burpee", exerciseType: "duration", source: "catalog" },
		];
		addTemplateExercisesToLibrary(library, [
			{ name: "Barbell bench press", targetSets: 3 },
			{ name: "Burpee", targetSets: 3, exerciseType: "timer" },
		], new Set(["barbell bench press"]));
		expect(library).toEqual([
			{ name: "barbell bench press", source: "catalog" },
			{ name: "Burpee", exerciseType: "duration", source: "catalog" },
		]);
	});
});
