// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ExerciseLibraryModal } from "../../src/components/exercise-library";
import { click } from "../helpers/dom";

function openEditor(onTypeChanged = vi.fn().mockResolvedValue(2)) {
	const onSave = vi.fn();
	new ExerciseLibraryModal({} as never, [{ name: "Plank", notes: "core" }], onSave, onTypeChanged).open();
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
