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

function clickChip(root: HTMLElement, bodyPart: string): void {
	const chip = Array.from(root.querySelectorAll<HTMLElement>(".ln-picker-chip")).find(
		(el) => el.textContent === bodyPart
	);
	expect(chip, bodyPart).toBeDefined();
	chip!.click();
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

	it("still offers the create rows when the query is an exact catalog name", () => {
		const { root, onSelect } = openPicker();
		input(root, ".ln-exercise-search", "burpee");
		expect(catalogNames(root)).toContain("⏲ Burpee");
		click(root, ".ln-exercise-create-timer");
		expect(onSelect).toHaveBeenCalledWith("burpee", "timer");
	});

	it("shows an owned exercise under its catalog body part, exactly once", () => {
		const { root } = openPicker([{ name: "Barbell bench press", exerciseType: "weight" }]);
		clickChip(root, "chest");

		expect(sectionLabels(root)).toEqual(["My library", "Catalog"]);
		expect(element(root, ".ln-exercise-result").textContent).toBe("Barbell bench press");
		expect(catalogNames(root)).not.toContain("Barbell bench press");
	});

	it("finds an owned exercise by metadata it never stored", () => {
		const { root } = openPicker([{ name: "Barbell bench press" }]);
		input(root, ".ln-exercise-search", "pectorals barbell bench press");

		expect(sectionLabels(root)).toContain("My library");
		expect(element(root, ".ln-exercise-result").textContent).toBe("Barbell bench press");
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

function press(el: HTMLElement, key: string, repeat = false): KeyboardEvent {
	const evt = new KeyboardEvent("keydown", { key, repeat, bubbles: true, cancelable: true });
	el.dispatchEvent(evt);
	return evt;
}

describe("ExercisePickerModal keyboard access", () => {
	it("makes chips and every kind of result row focusable buttons", () => {
		const { root } = openPicker([{ name: "My zercher squat" }]);
		input(root, ".ln-exercise-search", "zercher");
		const targets = Array.from(root.querySelectorAll<HTMLElement>(".ln-picker-chip, .ln-exercise-result"));
		expect(root.querySelectorAll(".ln-picker-chip").length).toBeGreaterThan(5);
		for (const cls of [".ln-catalog-result", ".ln-exercise-create", ".ln-exercise-create-timer", ".ln-exercise-create-duration"]) {
			expect(root.querySelector(cls), cls).not.toBeNull();
		}
		expect(targets.some((el) => el.textContent === "My zercher squat")).toBe(true);
		for (const el of targets) {
			expect(el.getAttribute("role"), el.textContent ?? "").toBe("button");
			expect(el.getAttribute("tabindex"), el.textContent ?? "").toBe("0");
		}
	});

	it("toggles a chip with Enter and Space and keeps focus on it", () => {
		const { root } = openPicker();
		const chip = element(root, ".ln-picker-chip");
		const bodyPart = chip.textContent;
		chip.focus();
		expect(press(chip, "Enter").defaultPrevented).toBe(true);
		const active = element(root, ".ln-picker-chip-active");
		expect(active.textContent).toBe(bodyPart);
		expect(active.getAttribute("aria-pressed")).toBe("true");
		expect(document.activeElement).toBe(active);
		expect(sectionLabels(root)).toEqual(["Catalog"]);
		press(active, " ");
		expect(root.querySelector(".ln-picker-chip-active")).toBeNull();
		expect(document.activeElement?.textContent).toBe(bodyPart);
		expect(sectionLabels(root)).toHaveLength(0);
	});

	it("selects catalog, library and create rows from the keyboard, ignoring other keys", () => {
		const { root, onSelect } = openPicker([{ name: "My crunch", exerciseType: "duration" }]);
		input(root, ".ln-exercise-search", "front plank with twist");
		press(element(root, ".ln-catalog-result"), "a");
		expect(onSelect).not.toHaveBeenCalled();
		press(element(root, ".ln-catalog-result"), "Enter");
		expect(onSelect).toHaveBeenLastCalledWith("Front plank with twist", "duration", "catalog");

		const second = openPicker([{ name: "My crunch", exerciseType: "duration" }]);
		press(element(second.root, ".ln-exercise-result"), " ");
		expect(second.onSelect).toHaveBeenLastCalledWith("My crunch", "duration");

		const third = openPicker();
		input(third.root, ".ln-exercise-search", "odd lift");
		press(element(third.root, ".ln-exercise-create-timer"), "Enter");
		expect(third.onSelect).toHaveBeenLastCalledWith("odd lift", "timer");
	});

	it("ignores auto-repeat while a key is held on a chip", () => {
		const { root } = openPicker();
		const chip = element(root, ".ln-picker-chip");
		const bodyPart = chip.textContent;
		chip.focus();
		press(chip, "Enter");
		const active = element(root, ".ln-picker-chip-active");
		for (let i = 0; i < 5; i++) expect(press(active, "Enter", true).defaultPrevented).toBe(true);
		expect(element(root, ".ln-picker-chip-active").textContent).toBe(bodyPart);
		expect(sectionLabels(root)).toEqual(["Catalog"]);
	});
});

