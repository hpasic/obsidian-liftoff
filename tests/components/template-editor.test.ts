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

	function pickCatalog(name: string) {
		click(document, ".ln-te-add-btn");
		input(document, ".ln-exercise-search", name);
		const row = Array.from(document.querySelectorAll<HTMLElement>(".ln-catalog-result"))
			.find((el) => el.querySelector(".ln-catalog-name")?.textContent?.replace("⏲ ", "") === name);
		expect(row, name).toBeDefined();
		row!.click();
	}

	function createTimer(name: string) {
		click(document, ".ln-te-add-btn");
		input(document, ".ln-exercise-search", name);
		click(document, ".ln-exercise-create-timer");
	}

	function save(onSave: ReturnType<typeof vi.fn>) {
		click(document, ".ln-te-save-btn");
		return onSave.mock.calls[0]! as [{ exercises: object[] }, Set<string>];
	}

	it("drops a removed catalog pick's provenance before a same-name create", () => {
		const onSave = vi.fn();
		new TemplateEditorModal({} as never, { type: "workout-template", name: "Core", exercises: [] }, [], [], onSave).open();
		pickCatalog("Burpee");
		click(document, ".ln-te-remove-btn");
		createTimer("Burpee");
		const [template, catalogNames] = save(onSave);
		expect(template.exercises).toEqual([{ name: "Burpee", targetSets: 3, exerciseType: "timer" }]);
		expect([...catalogNames]).toEqual([]);
	});

	it("does not mark a name as catalog when another retained row with it was created by hand", () => {
		const onSave = vi.fn();
		new TemplateEditorModal({} as never, { type: "workout-template", name: "Core", exercises: [] }, [], [], onSave).open();
		createTimer("burpee");
		pickCatalog("Burpee");
		const [template, catalogNames] = save(onSave);
		// Template rows stay plain — provenance is never written to the file
		expect(template.exercises).toEqual([
			{ name: "burpee", targetSets: 3, exerciseType: "timer" },
			{ name: "Burpee", targetSets: 3, exerciseType: "duration" },
		]);
		expect([...catalogNames]).toEqual([]);
	});

	it("ignores rows already in the template when deciding catalog provenance", () => {
		const onSave = vi.fn();
		new TemplateEditorModal({} as never,
			{ type: "workout-template", name: "Core", exercises: [{ name: "Burpee", targetSets: 2 }] }, [], [], onSave).open();
		pickCatalog("Burpee");
		expect([...save(onSave)[1]]).toEqual([]);
	});

	it("copies a library pick's unilateral flag and toggles it per row", () => {
		const onSave = vi.fn();
		new TemplateEditorModal({} as never, { type: "workout-template", name: "Legs", exercises: [] },
			[{ name: "Walking Lunge", unilateral: true }, { name: "Squat" }, { name: "Plank", exerciseType: "duration" }],
			[], onSave).open();
		for (const name of ["walking lunge", "squat"]) {
			click(document, ".ln-te-add-btn");
			input(document, ".ln-exercise-search", name);
			click(document, ".ln-exercise-result");
		}
		createTimer("Tabata");
		click(document, ".ln-te-add-btn");
		input(document, ".ln-exercise-search", "plank");
		click(document, ".ln-exercise-result");
		// Library-typed duration row gets no chip; switching it to weight shows one
		expect(document.querySelectorAll(".ln-te-sides-btn")).toHaveLength(2);
		const plankType = Array.from(document.querySelectorAll<HTMLSelectElement>(".ln-te-type-select"))[3]!;
		plankType.value = "weight";
		plankType.dispatchEvent(new Event("change"));
		expect(document.querySelectorAll(".ln-te-sides-btn")).toHaveLength(3);
		const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".ln-te-sides-btn")).slice(0, 2);
		expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
		buttons[0]!.click();
		buttons[1]!.click();
		expect(buttons.map((b) => b.classList.contains("ln-te-sides-btn-active"))).toEqual([false, true]);
		const [template] = save(onSave);
		expect(JSON.parse(JSON.stringify(template.exercises))).toEqual([
			{ name: "Walking Lunge", targetSets: 3 },
			{ name: "Squat", targetSets: 3, unilateral: true },
			{ name: "Tabata", targetSets: 3, exerciseType: "timer" },
			{ name: "Plank", targetSets: 3, exerciseType: "weight" },
		]);
	});

	it("changes a row's type, showing the library's type until then", () => {
		const onSave = vi.fn();
		new TemplateEditorModal({} as never, {
			type: "workout-template", name: "Core",
			exercises: [{ name: "Plank", targetSets: 3 }, { name: "Row", targetSets: 3, exerciseType: "timer" }],
		}, [{ name: "plank", exerciseType: "duration" }], [], onSave).open();
		const selects = () => Array.from(document.querySelectorAll<HTMLSelectElement>(".ln-te-type-select"));
		expect(selects().map((s) => s.value)).toEqual(["duration", "timer"]);

		const plank = selects()[0]!;
		plank.value = "weight";
		plank.dispatchEvent(new Event("change"));
		const row = selects()[1]!;
		row.value = "duration";
		row.dispatchEvent(new Event("change"));
		expect(document.querySelectorAll(".ln-te-sets-label")[1]!.textContent).toBe("3 holds");

		click(document, ".ln-te-save-btn");
		expect(onSave.mock.calls[0]![0].exercises).toEqual([
			{ name: "Plank", targetSets: 3, exerciseType: "weight" },
			{ name: "Row", targetSets: 3, exerciseType: "duration" },
		]);
	});
});
