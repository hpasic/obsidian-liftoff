// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { TemplateEditorModal } from "../../src/components/template-editor";
import { click, input } from "../helpers/dom";

describe("TemplateEditorModal", () => {
	it("reports which saved exercises were picked from the catalog", () => {
		const onSave = vi.fn();
		const editor = new TemplateEditorModal({} as never, { type: "workout-template", name: "Core", exercises: [] },
			[{ name: "My crunch" }], [], onSave);
		editor.open();

		click(document, ".ln-te-add-btn");
		input(document, ".ln-exercise-search", "front plank with twist");
		click(document, ".ln-catalog-result");

		click(document, ".ln-te-add-btn");
		input(document, ".ln-exercise-search", "my crunch");
		click(document, ".ln-exercise-result");

		click(document, ".ln-te-save-btn");
		expect(onSave).toHaveBeenCalledTimes(1);
		const [template, catalogNames] = onSave.mock.calls[0]!;
		expect(template.exercises.map((e: { name: string }) => e.name)).toEqual(["Front plank with twist", "My crunch"]);
		expect([...catalogNames]).toEqual(["front plank with twist"]);
	});
});
