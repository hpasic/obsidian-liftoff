import { describe, expect, it, vi } from "vitest";
import { TFile, TFolder, type App } from "obsidian";
import { parse, stringify } from "yaml";
import { TemplateStore } from "../../src/storage/template-store";
import { DEFAULT_SETTINGS, type WorkoutTemplate } from "../../src/types";

// The obsidian mock has no parseYaml; getTemplates needs a real one
vi.mock("obsidian", async (importOriginal) => ({
	...(await importOriginal<typeof import("obsidian")>()),
	parseYaml: (text: string) => parse(text) as unknown,
}));

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
	it("round-trips unilateral weight exercises, explicit weight included, and writes nothing for others", async () => {
		const { store, content } = memoryVault();
		const template: WorkoutTemplate = {
			type: "workout-template", name: "Legs",
			exercises: [
				{ name: "Walking Lunge", targetSets: 3, unilateral: true },
				{ name: "Squat", targetSets: 4 },
				{ name: "Lunge", targetSets: 3, unilateral: false },
				{ name: "Plank", targetSets: 2, exerciseType: "duration", unilateral: true },
				{ name: "Pistol Squat", targetSets: 2, exerciseType: "weight", unilateral: true },
			],
		};
		await store.saveTemplate(template);
		expect(content()).toBe([
			"---", "type: workout-template", "name: Legs", "exercises:",
			"  - name: Walking Lunge", "    targetSets: 3", "    unilateral: true",
			"  - name: Squat", "    targetSets: 4",
			"  - name: Lunge", "    targetSets: 3", "    unilateral: false",
			"  - name: Plank", "    targetSets: 2", "    exerciseType: duration",
			"  - name: Pistol Squat", "    targetSets: 2", "    exerciseType: weight", "    unilateral: true",
			"---", "",
		].join("\n"));
		const [loaded] = await store.getTemplates();
		expect(loaded!.exercises).toEqual([
			{ name: "Walking Lunge", targetSets: 3, exerciseType: undefined, unilateral: true },
			{ name: "Squat", targetSets: 4, exerciseType: undefined },
			{ name: "Lunge", targetSets: 3, exerciseType: undefined, unilateral: false },
			{ name: "Plank", targetSets: 2, exerciseType: "duration" },
			{ name: "Pistol Squat", targetSets: 2, exerciseType: "weight", unilateral: true },
		]);
		expect(loaded!.exercises[1]).not.toHaveProperty("unilateral");
	});
});

describe("TemplateStore.retypeExercise", () => {
	function vault(files: Record<string, string>) {
		const content = new Map(Object.entries(files));
		const tfiles = [...content.keys()].map((path) => Object.assign(new TFile(), {
			path, basename: path.split("/").pop()!.replace(/\.md$/, ""),
		}));
		const folder = Object.assign(new TFolder(), { path: "Workout Templates", children: tfiles });
		// Obsidian's processFrontMatter edits only the YAML block of the given file
		const processFrontMatter = vi.fn(async (file: TFile, fn: (fm: Record<string, unknown>) => void) => {
			const [, yaml, body] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content.get(file.path)!)!;
			const fm = parse(yaml!) as Record<string, unknown>;
			fn(fm);
			content.set(file.path, `---\n${stringify(fm)}---\n${body}`);
		});
		const create = vi.fn();
		const modify = vi.fn();
		const app = {
			vault: {
				getAbstractFileByPath: (path: string) => path === folder.path ? folder : tfiles.find((f) => f.path === path) ?? null,
				read: vi.fn(async (file: TFile) => content.get(file.path)!),
				create, modify,
			},
			fileManager: { processFrontMatter },
		} as unknown as App;
		return { store: new TemplateStore(app, () => DEFAULT_SETTINGS), content, processFrontMatter, create, modify };
	}

	it("edits each file's frontmatter in place, keeping body, other properties and renamed files", async () => {
		const legs = [
			"---", "type: workout-template", "name: Legs", "tags:", "  - gym", "exercises:",
			"  - name: Squat", "    targetSets: 4", "  - name: plank", "    targetSets: 2", "---",
			"Warm up first.", "",
		].join("\n");
		const renamed = [
			"---", "type: workout-template", "name: Core", "exercises:",
			"  - name: Plank", "    targetSets: 1", "    exerciseType: timer", "---", "",
		].join("\n");
		const untouched = [
			"---", "type: workout-template", "name: Arms", "exercises:", "  - name: Curl", "    targetSets: 3", "---", "",
		].join("\n");
		const { store, content, processFrontMatter, create, modify } = vault({
			"Workout Templates/Legs.md": legs,
			"Workout Templates/My core day.md": renamed,
			"Workout Templates/Arms.md": untouched,
		});

		expect(await store.retypeExercise("Plank", "duration")).toBe(2);

		expect(create).not.toHaveBeenCalled();
		expect(modify).not.toHaveBeenCalled();
		expect(processFrontMatter).toHaveBeenCalledTimes(2);
		expect([...content.keys()]).toEqual(["Workout Templates/Legs.md", "Workout Templates/My core day.md", "Workout Templates/Arms.md"]);
		const legsAfter = content.get("Workout Templates/Legs.md")!;
		expect(legsAfter).toMatch(/\n---\nWarm up first\.\n$/);
		expect(parse(legsAfter.split("---")[1]!)).toEqual({
			type: "workout-template", name: "Legs", tags: ["gym"],
			exercises: [{ name: "Squat", targetSets: 4 }, { name: "plank", targetSets: 2, exerciseType: "duration" }],
		});
		expect(parse(content.get("Workout Templates/My core day.md")!.split("---")[1]!).exercises)
			.toEqual([{ name: "Plank", targetSets: 1, exerciseType: "duration" }]);
		expect(content.get("Workout Templates/Arms.md")).toBe(untouched);

		// Already that type everywhere: nothing written, nothing counted
		expect(await store.retypeExercise("Plank", "duration")).toBe(0);
		expect(processFrontMatter).toHaveBeenCalledTimes(2);
	});
});
