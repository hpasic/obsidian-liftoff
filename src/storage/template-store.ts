import { App, TFile, TFolder, normalizePath, parseYaml } from "obsidian";
import type { WorkoutTemplate, TemplateExercise, LiftOffSettings } from "../types";

export class TemplateStore {
	constructor(
		private app: App,
		private getSettings: () => LiftOffSettings
	) {}

	async getTemplates(): Promise<WorkoutTemplate[]> {
		const settings = this.getSettings();
		const folderPath = normalizePath(settings.templateFolder);
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!(folder instanceof TFolder)) {
			return [];
		}

		const templates: WorkoutTemplate[] = [];

		for (const file of folder.children) {
			if (!(file instanceof TFile) || file.extension !== "md") continue;

			const content = await this.app.vault.read(file);
			const fm = this.parseFrontmatter(content);
			if (!fm || fm.type !== "workout-template") continue;

			const exercises: TemplateExercise[] = [];
			if (Array.isArray(fm.exercises)) {
				for (const ex of fm.exercises as Array<Record<string, unknown>>) {
					exercises.push({
						name: String(ex.name),
						targetSets: Number(ex.targetSets) || 3,
						exerciseType: ex.exerciseType === "timer" ? "timer" : undefined,
					});
				}
			}

			templates.push({
				type: "workout-template",
				name: typeof fm.name === "string" ? fm.name : file.basename,
				exercises,
			});
		}

		return templates;
	}

	async saveTemplate(template: WorkoutTemplate): Promise<TFile> {
		const settings = this.getSettings();
		const folderPath = normalizePath(settings.templateFolder);
		await this.ensureFolder(folderPath);

		const filePath = normalizePath(`${folderPath}/${template.name}.md`);

		const lines: string[] = ["---"];
		lines.push("type: workout-template");
		lines.push(`name: ${template.name}`);
		lines.push("exercises:");
		for (const ex of template.exercises) {
			lines.push(`  - name: ${ex.name}`);
			lines.push(`    targetSets: ${ex.targetSets}`);
			if (ex.exerciseType === "timer") {
				lines.push(`    exerciseType: timer`);
			}
		}
		lines.push("---");
		lines.push("");

		const content = lines.join("\n");

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			return existing;
		}

		return await this.app.vault.create(filePath, content);
	}

	async deleteTemplate(name: string): Promise<void> {
		const settings = this.getSettings();
		const filePath = normalizePath(`${settings.templateFolder}/${name}.md`);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await this.app.fileManager.trashFile(file);
		}
	}

	private parseFrontmatter(content: string): Record<string, unknown> | null {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match || !match[1]) return null;
		try {
			return parseYaml(match[1]) as Record<string, unknown>;
		} catch {
			return null;
		}
	}

	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}
}
