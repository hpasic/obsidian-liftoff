import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import { TemplateStore } from "../../src/storage/template-store";
import { DEFAULT_SETTINGS } from "../../src/types";

describe("TemplateStore.saveTemplate", () => {
	it("writes an explicit weight type so it overrides the library", async () => {
		const create = vi.fn().mockResolvedValue({});
		const app = { vault: { getAbstractFileByPath: () => ({}), create } } as unknown as App;
		await new TemplateStore(app, () => DEFAULT_SETTINGS).saveTemplate({
			type: "workout-template", name: "Core",
			exercises: [
				{ name: "Plank", targetSets: 3, exerciseType: "weight" },
				{ name: "Row", targetSets: 3 },
			],
		});
		const content = create.mock.calls[0]![1] as string;
		expect(content).toContain("  - name: Plank\n    targetSets: 3\n    exerciseType: weight\n");
		expect(content).toContain("  - name: Row\n    targetSets: 3\n---");
	});
});
