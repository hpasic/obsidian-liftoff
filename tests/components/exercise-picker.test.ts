// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ExercisePickerModal } from "../../src/components/exercise-picker";
import type { ExerciseLibraryEntry } from "../../src/types";
import { click, element, input } from "../helpers/dom";

function openPicker(library: ExerciseLibraryEntry[] = [], recentNames: string[] = []) {
	const onSelect = vi.fn();
	const modal = new ExercisePickerModal({} as never, library, recentNames, onSelect);
	modal.open();
	return { modal, root: modal.modalEl, onSelect };
}

function sectionLabels(root: HTMLElement): string[] {
	return Array.from(root.querySelectorAll(".ln-exercise-section-label")).map(
		(el) => el.textContent ?? ""
	);
}

function catalogNames(root: HTMLElement): string[] {
	return Array.from(root.querySelectorAll(".ln-catalog-name")).map((el) => el.textContent ?? "");
}

describe("ExercisePickerModal catalog", () => {
	it("keeps the catalog hidden until there is a query or a chip", () => {
		const { root } = openPicker([{ name: "My squat" }]);
		expect(catalogNames(root)).toHaveLength(0);
		expect(sectionLabels(root)).not.toContain("Catalog");
		expect(root.querySelectorAll(".ln-picker-chip").length).toBeGreaterThan(5);
	});

	it("reveals a body-part slice when a chip is tapped, and clears it on a second tap", () => {
		const { root } = openPicker();
		click(root, ".ln-picker-chip");
		expect(sectionLabels(root)).toEqual(["Catalog"]);
		expect(catalogNames(root)).toHaveLength(50);
		expect(element(root, ".ln-picker-more").textContent).toContain("more");

		click(root, ".ln-picker-chip");
		expect(sectionLabels(root)).toHaveLength(0);
		expect(catalogNames(root)).toHaveLength(0);
	});

	it("puts the user's library first and hides the colliding catalog row", () => {
		const { root } = openPicker([{ name: "barbell BENCH press", exerciseType: "weight" }]);
		input(root, ".ln-exercise-search", "barbell bench press");

		expect(sectionLabels(root)).toEqual(["My library", "Catalog"]);
		expect(element(root, ".ln-exercise-result").textContent).toBe("barbell BENCH press");
		expect(catalogNames(root)).not.toContain("Barbell bench press");
	});

	it("matches every token across name, target, and equipment", () => {
		const { root } = openPicker();
		input(root, ".ln-exercise-search", "db curl");
		const names = catalogNames(root);
		expect(names.length).toBeGreaterThan(0);
		expect(names.every((name) => name.toLowerCase().includes("curl"))).toBe(true);
		expect(names).toContain("Dumbbell biceps curl");
	});

	it("reports the catalog entry and its derived type on select, flagged as catalog", () => {
		const { root, onSelect } = openPicker();
		input(root, ".ln-exercise-search", "front plank with twist");
		click(root, ".ln-catalog-result");
		expect(onSelect).toHaveBeenCalledWith("Front plank with twist", "duration", "catalog");
	});

	it("keeps the custom create path last", () => {
		const { root, onSelect } = openPicker();
		input(root, ".ln-exercise-search", "zercher good morning thing");
		const results = Array.from(root.querySelectorAll(".ln-exercise-result"));
		expect(results.at(-3)?.textContent).toBe('+ Create "zercher good morning thing"');
		expect(results.at(-1)?.className).toContain("ln-exercise-create-duration");
		click(root, ".ln-exercise-create");
		expect(onSelect).toHaveBeenCalledWith("zercher good morning thing", "weight");
	});
});
