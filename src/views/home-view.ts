import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type LiftOffPlugin from "../main";
import type { WorkoutTemplate } from "../types";
import { TextInputModal, ConfirmModal } from "../components/modals";
import { TemplateEditorModal } from "../components/template-editor";
import { ExerciseLibraryModal } from "../components/exercise-library";

export const HOME_VIEW_TYPE = "liftoff-home";

export class HomeView extends ItemView {
	private plugin: LiftOffPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: LiftOffPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return HOME_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Liftoff";
	}

	getIcon(): string {
		return "dumbbell";
	}

	async onOpen(): Promise<void> {
		await this.renderHome();
	}

	async renderHome(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("ln-home-view");

		const startBtn = container.createEl("button", {
			cls: "ln-start-workout-btn",
			text: "+ start empty workout",
		});
		startBtn.addEventListener("click", () => {
			void this.plugin.startWorkout(null);
		});

		const templatesSection = container.createDiv({ cls: "ln-section" });
		const templatesHeader = templatesSection.createDiv({ cls: "ln-section-header" });
		templatesHeader.createSpan({
			cls: "ln-section-title",
			text: "Templates",
		});

		const newTemplateBtn = templatesHeader.createEl("button", {
			cls: "ln-new-template-btn",
			text: "+ new",
		});
		newTemplateBtn.addEventListener("click", () => {
			void this.createNewTemplate();
		});

		const templatesList = templatesSection.createDiv({ cls: "ln-templates-list" });
		await this.renderTemplates(templatesList);

		// Exercises section
		const exercisesSection = container.createDiv({ cls: "ln-section" });
		const exercisesHeader = exercisesSection.createDiv({ cls: "ln-section-header" });
		exercisesHeader.createSpan({
			cls: "ln-section-title",
			text: "Exercises",
		});
		const manageBtn = exercisesHeader.createEl("button", {
			cls: "ln-new-template-btn",
			text: `${this.plugin.settings.exerciseLibrary.length} exercises`,
		});
		manageBtn.addEventListener("click", () => {
			this.openExerciseLibrary();
		});

		const recentSection = container.createDiv({ cls: "ln-section" });
		recentSection.createDiv({
			cls: "ln-section-header",
		}).createSpan({
			cls: "ln-section-title",
			text: "Recent Workouts",
		});

		const recentList = recentSection.createDiv({ cls: "ln-recent-list" });
		this.renderRecentWorkouts(recentList);
	}

	private async renderTemplates(containerEl: HTMLElement): Promise<void> {
		const templates = await this.plugin.templateStore.getTemplates();

		if (templates.length === 0) {
			containerEl.createDiv({
				cls: "ln-empty-state",
				text: "No templates yet. Create one to get started!",
			});
			return;
		}

		for (const template of templates) {
			const item = containerEl.createDiv({ cls: "ln-template-item" });
			const info = item.createDiv({ cls: "ln-template-info" });
			info.createDiv({
				cls: "ln-template-name",
				text: template.name,
			});
			info.createDiv({
				cls: "ln-template-preview",
				text: template.exercises.length > 0
					? template.exercises.map((e) => e.name).join(", ")
					: "No exercises — tap edit to add",
			});

			const actions = item.createDiv({ cls: "ln-template-actions" });

			const editBtn = actions.createEl("button", {
				cls: "ln-template-edit-btn",
				text: "\u270E",
			});
			editBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.openTemplateEditor(template);
			});

			const deleteBtn = actions.createEl("button", {
				cls: "ln-template-delete-btn",
				text: "\u00D7",
			});
			deleteBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void (async () => {
					const confirmed = await new ConfirmModal(this.app, `Delete template "${template.name}"?`).openAndWait();
					if (confirmed) {
						await this.plugin.templateStore.deleteTemplate(template.name);
						await this.renderHome();
					}
				})();
			});

			item.addEventListener("click", () => {
				if (template.exercises.length === 0) {
					this.openTemplateEditor(template);
				} else {
					void this.plugin.startWorkout(template);
				}
			});
		}
	}

	private renderRecentWorkouts(containerEl: HTMLElement): void {
		const recent = this.plugin.workoutStore.getRecentWorkouts(10);

		if (recent.length === 0) {
			containerEl.createDiv({
				cls: "ln-empty-state",
				text: "No workouts yet. Start one!",
			});
			return;
		}

		for (const workout of recent) {
			const item = containerEl.createDiv({ cls: "ln-recent-item" });
			const info = item.createDiv({ cls: "ln-recent-info" });

			const nameRow = info.createDiv({ cls: "ln-recent-name-row" });
			nameRow.createSpan({
				cls: "ln-recent-name",
				text: workout.template ?? "Workout",
			});
			if (workout.duration) {
				nameRow.createSpan({
					cls: "ln-recent-duration",
					text: `${workout.duration} min`,
				});
			}

			item.createSpan({
				cls: "ln-recent-date",
				text: workout.date,
			});
		}
	}

	private async createNewTemplate(): Promise<void> {
		const name = await new TextInputModal(this.app, "Template name:", "e.g. Push Day").openAndWait();
		if (!name) return;

		const template: WorkoutTemplate = {
			type: "workout-template",
			name,
			exercises: [],
		};

		await this.plugin.templateStore.saveTemplate(template);
		this.openTemplateEditor(template);
	}

	private openTemplateEditor(template: WorkoutTemplate): void {
		new TemplateEditorModal(
			this.app,
			template,
			this.plugin.settings.exerciseLibrary,
			[],
			(updated) => {
				void (async () => {
					await this.plugin.templateStore.saveTemplate(updated);
					new Notice(`Template "${updated.name}" saved.`);
					await this.renderHome();
				})();
			}
		).open();
	}

	private openExerciseLibrary(): void {
		new ExerciseLibraryModal(
			this.app,
			this.plugin.settings.exerciseLibrary,
			(updatedLibrary) => {
				void (async () => {
					this.plugin.settings.exerciseLibrary = updatedLibrary;
					await this.plugin.saveSettings();
					await this.renderHome();
				})();
			}
		).open();
	}

	async onClose(): Promise<void> {}
}
