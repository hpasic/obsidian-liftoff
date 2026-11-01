// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ExerciseLibraryModal } from "../../src/components/exercise-library";
import type { ExerciseLibraryEntry } from "../../src/types";
import { click, element } from "../helpers/dom";

function openEditor(
	onTypeChanged = vi.fn().mockResolvedValue(2),
	library: ExerciseLibraryEntry[] = [{ name: "Plank", notes: "core" }]
) {
	const onSave = vi.fn();
	new ExerciseLibraryModal({} as never, library, onSave, onTypeChanged).open();
	click(document, ".ln-el-action-btn"); // Edit
	return { onSave, onTypeChanged };
}

function typeButton(label: string): HTMLButtonElement {
	return Array.from(document.querySelectorAll<HTMLButtonElement>(".ln-el-type-btn"))
		.find((b) => b.textContent === label)!;
}

describe("ExerciseLibraryModal type change", () => {
	it("saves the new type and pushes it to the templates under the saved name", async () => {
		const { onSave, onTypeChanged } = openEditor();
		typeButton("Duration").click();
		click(document, ".ln-el-edit-save");
		await Promise.resolve();
		expect(onSave).toHaveBeenCalledWith([{ name: "Plank", exerciseType: "duration", notes: "core" }]);
		expect(onTypeChanged).toHaveBeenCalledWith("Plank", "duration");
	});

	it("does not touch templates when only the notes change", () => {
		const { onSave, onTypeChanged } = openEditor();
		typeButton("Weight").click();
		click(document, ".ln-el-edit-save");
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onTypeChanged).not.toHaveBeenCalled();
	});
});

describe("ExerciseLibraryModal unilateral flag", () => {
	it("marks a weight exercise left / right and shows it in the list", () => {
		const { onSave } = openEditor(undefined, [{ name: "Walking Lunge", notes: "long steps" }]);
		const sides = element(document, ".ln-el-sides-row");
		expect(sides.classList.contains("ln-el-hidden")).toBe(false);
		expect(element(sides, ".ln-el-sides-both").classList.contains("ln-el-type-btn-active")).toBe(true);
		click(sides, ".ln-el-sides-each");
		click(document, ".ln-el-edit-save");
		expect(onSave).toHaveBeenCalledWith([{ name: "Walking Lunge", notes: "long steps", unilateral: true }]);
		expect(element(document, ".ln-el-unilateral-badge").textContent).toBe("L / R");
	});

	it("clears the flag when switched back or when the type is no longer weight", () => {
		const { onSave } = openEditor(undefined, [{ name: "Lunge", unilateral: true }]);
		const sides = element(document, ".ln-el-sides-row");
		expect(element(sides, ".ln-el-sides-each").classList.contains("ln-el-type-btn-active")).toBe(true);
		typeButton("Duration").click();
		expect(sides.classList.contains("ln-el-hidden")).toBe(true);
		click(document, ".ln-el-edit-save");
		expect(onSave).toHaveBeenLastCalledWith([{ name: "Lunge", exerciseType: "duration" }]);

		click(document, ".ln-el-action-btn");
		typeButton("Weight").click();
		click(document, ".ln-el-sides-both");
		click(document, ".ln-el-edit-save");
		expect(onSave).toHaveBeenLastCalledWith([{ name: "Lunge" }]);
	});
});
