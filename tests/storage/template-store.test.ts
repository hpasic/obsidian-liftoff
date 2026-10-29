import { describe, expect, it, vi } from "vitest";
import { TFile, TFolder, type App } from "obsidian";
import { parse } from "yaml";
import { DEFAULT_SETTINGS, type WorkoutTemplate } from "../../src/types";

vi.mock("obsidian", async (importOriginal) => ({
	...(await importOriginal<typeof import("obsidian")>()),
	parseYaml: (text: string) => parse(text) as unknown,
}));

const { TemplateStore } = await import("../../src/storage/template-store");

function memoryVault() {
	const file = Object.assign(new TFile(), { path: "Workout Templates/Legs.md", basename: "Legs" });
	const folder = Object.assign(new TFolder(), { path: "Workout Templates", children: [] as TFile[] });
	let content = "";
	const app = {
		vault: {
			getAbstractFileByPath: (path: string) =>
				path === folder.path ? folder : folder.children.find((f) => f.path === path) ?? null,
			create: vi.fn(async (_path: string, text: string) => {
				content = text;
				folder.children.push(file);
				return file;
			}),
			read: vi.fn(async () => content),
		},
	} as unknown as App;
	return { store: new TemplateStore(app, () => DEFAULT_SETTINGS), content: () => content };
}

describe("TemplateStore unilateral flag", () => {
	it("round-trips unilateral weight exercises and writes nothing for others", async () => {
		const { store, content } = memoryVault();
		const template: WorkoutTemplate = {
			type: "workout-template", name: "Legs",
			exercises: [
				{ name: "Walking Lunge", targetSets: 3, unilateral: true },
				{ name: "Squat", targetSets: 4 },
				{ name: "Plank", targetSets: 2, exerciseType: "duration" },
			],
		};
		await store.saveTemplate(template);
		expect(content()).toBe([
			"---", "type: workout-template", "name: Legs", "exercises:",
			"  - name: Walking Lunge", "    targetSets: 3", "    unilateral: true",
			"  - name: Squat", "    targetSets: 4",
			"  - name: Plank", "    targetSets: 2", "    exerciseType: duration",
			"---", "",
		].join("\n"));
		const [loaded] = await store.getTemplates();
		expect(loaded!.exercises).toEqual([
			{ name: "Walking Lunge", targetSets: 3, exerciseType: undefined, unilateral: true },
			{ name: "Squat", targetSets: 4, exerciseType: undefined },
			{ name: "Plank", targetSets: 2, exerciseType: "duration" },
		]);
		expect(loaded!.exercises[1]).not.toHaveProperty("unilateral");
	});
});
