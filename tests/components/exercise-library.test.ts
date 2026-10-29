// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ExerciseLibraryModal } from "../../src/components/exercise-library";
import type { ExerciseLibraryEntry } from "../../src/types";
import { click, element } from "../helpers/dom";

function open(library: ExerciseLibraryEntry[]) {
	const onSave = vi.fn();
	new ExerciseLibraryModal({} as never, library, onSave).open();
	click(document, ".ln-el-action-btn");
	return onSave;
}

describe("ExerciseLibraryModal unilateral flag", () => {
	it("marks a weight exercise left / right and shows it in the list", () => {
		const onSave = open([{ name: "Walking Lunge", notes: "long steps" }]);
		const sides = element(document, ".ln-el-sides-row");
		expect(sides.classList.contains("ln-el-hidden")).toBe(false);
		expect(element(sides, ".ln-el-sides-both").classList.contains("ln-el-type-btn-active")).toBe(true);
		click(sides, ".ln-el-sides-each");
		click(document, ".ln-el-edit-save");
		expect(onSave).toHaveBeenCalledWith([{ name: "Walking Lunge", notes: "long steps", unilateral: true }]);
		expect(element(document, ".ln-el-unilateral-badge").textContent).toBe("L / R");
	});

	it("clears the flag when switched back or when the type is no longer weight", () => {
		const onSave = open([{ name: "Lunge", unilateral: true }]);
		const sides = element(document, ".ln-el-sides-row");
		expect(element(sides, ".ln-el-sides-each").classList.contains("ln-el-type-btn-active")).toBe(true);
		const durationBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".ln-el-type-btn"))
			.find((b) => b.textContent === "Duration")!;
		durationBtn.click();
		expect(sides.classList.contains("ln-el-hidden")).toBe(true);
		click(document, ".ln-el-edit-save");
		expect(onSave).toHaveBeenLastCalledWith([{ name: "Lunge", exerciseType: "duration" }]);

		click(document, ".ln-el-action-btn");
		const weightBtn = Array.from(document.querySelectorAll<HTMLButtonElement>(".ln-el-type-btn"))
			.find((b) => b.textContent === "Weight")!;
		weightBtn.click();
		click(document, ".ln-el-sides-both");
		click(document, ".ln-el-edit-save");
		expect(onSave).toHaveBeenLastCalledWith([{ name: "Lunge" }]);
	});
});
