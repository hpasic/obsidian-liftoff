import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, type LiftOffSettings, type WorkoutTemplate } from "./types";
import { LiftOffSettingTab } from "./settings";
import { WorkoutStore } from "./storage/workout-store";
import { TemplateStore } from "./storage/template-store";
import { HomeView, HOME_VIEW_TYPE } from "./views/home-view";
import { WorkoutView, WORKOUT_VIEW_TYPE } from "./views/workout-view";

export default class LiftOffPlugin extends Plugin {
	settings: LiftOffSettings = DEFAULT_SETTINGS;
	workoutStore: WorkoutStore = null!;
	templateStore: TemplateStore = null!;

	async onload() {
		await this.loadSettings();

		this.workoutStore = new WorkoutStore(this.app, () => this.settings);
		this.templateStore = new TemplateStore(this.app, () => this.settings);

		this.registerView(HOME_VIEW_TYPE, (leaf) => new HomeView(leaf, this));
		this.registerView(WORKOUT_VIEW_TYPE, (leaf) => new WorkoutView(leaf, this));

		this.addSettingTab(new LiftOffSettingTab(this.app, this));

		this.addRibbonIcon("dumbbell", "Open liftoff", () => {
			void this.showHomeView();
		});

		this.addCommand({
			id: "open-home",
			name: "Open home",
			callback: () => {
				void this.showHomeView();
			},
		});

		this.addCommand({
			id: "start-empty-workout",
			name: "Start empty workout",
			callback: () => {
				void this.startWorkout(null);
			},
		});
	}

	onunload() {}

	private getOrCreateLeaf(): WorkspaceLeaf {
		// Reuse an existing plugin leaf to avoid "No tab group" errors
		const existing =
			this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE)[0] ??
			this.app.workspace.getLeavesOfType(WORKOUT_VIEW_TYPE)[0];
		return existing ?? this.app.workspace.getLeaf(false);
	}

	async showHomeView(): Promise<void> {
		const leaf = this.getOrCreateLeaf();

		// Clean up any extra leaves
		for (const l of this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE)) {
			if (l !== leaf) l.detach();
		}
		for (const l of this.app.workspace.getLeavesOfType(WORKOUT_VIEW_TYPE)) {
			if (l !== leaf) l.detach();
		}

		await leaf.setViewState({
			type: HOME_VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}

	async startWorkout(template: WorkoutTemplate | null): Promise<void> {
		const leaf = this.getOrCreateLeaf();

		// Clean up any extra leaves
		for (const l of this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE)) {
			if (l !== leaf) l.detach();
		}
		for (const l of this.app.workspace.getLeavesOfType(WORKOUT_VIEW_TYPE)) {
			if (l !== leaf) l.detach();
		}

		await leaf.setViewState({
			type: WORKOUT_VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (view instanceof WorkoutView) {
			if (template) {
				await view.startFromTemplate(template);
			} else {
				await view.startEmpty();
			}
		}
	}

	async loadSettings() {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<LiftOffSettings>) };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
