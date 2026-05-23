import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import {
	DEFAULT_SETTINGS,
	type ActiveWorkout,
	type LiftOffSettings,
	type Workout,
	type WorkoutTemplate,
} from "./types";
import { LiftOffSettingTab } from "./settings";
import { WorkoutStore } from "./storage/workout-store";
import { TemplateStore } from "./storage/template-store";
import { HomeView, HOME_VIEW_TYPE } from "./views/home-view";
import { WorkoutView, WORKOUT_VIEW_TYPE } from "./views/workout-view";
import { ConfirmModal } from "./components/modals";

interface PluginData {
	settings: LiftOffSettings;
	activeWorkout: ActiveWorkout | null;
}

export default class LiftOffPlugin extends Plugin {
	settings: LiftOffSettings = DEFAULT_SETTINGS;
	activeWorkout: ActiveWorkout | null = null;
	workoutStore: WorkoutStore = null!;
	templateStore: TemplateStore = null!;

	async onload() {
		await this.loadPluginData();

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

		this.addCommand({
			id: "resume-active-workout",
			name: "Resume active workout",
			checkCallback: (checking) => {
				if (!this.activeWorkout) return false;
				if (!checking) {
					void this.resumeActiveWorkout();
				}
				return true;
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
		if (this.activeWorkout) {
			const discard = await new ConfirmModal(
				this.app,
				"You have a workout in progress. Discard it and start a new one?"
			).openAndWait();
			if (!discard) {
				await this.resumeActiveWorkout();
				return;
			}
			await this.clearActiveWorkout();
		}

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
				view.startFromTemplate(template);
			} else {
				view.startEmpty();
			}
		}
	}

	async resumeActiveWorkout(): Promise<void> {
		const active = this.activeWorkout;
		if (!active) {
			new Notice("No workout in progress.");
			return;
		}

		const leaf = this.getOrCreateLeaf();

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
			view.resume(active);
		}
	}

	async persistActiveWorkout(workout: Workout, startTimeMs: number): Promise<void> {
		this.activeWorkout = { workout, startTimeMs };
		await this.savePluginData();
	}

	async clearActiveWorkout(): Promise<void> {
		this.activeWorkout = null;
		await this.savePluginData();
	}

	async loadPluginData() {
		const raw = (await this.loadData()) as Partial<PluginData & LiftOffSettings> | null;
		if (raw && typeof raw === "object" && "settings" in raw && raw.settings) {
			this.settings = { ...DEFAULT_SETTINGS, ...raw.settings };
			this.activeWorkout = raw.activeWorkout ?? null;
		} else {
			// Legacy shape: data.json was the settings object itself.
			this.settings = { ...DEFAULT_SETTINGS, ...(raw as Partial<LiftOffSettings> | null) };
			this.activeWorkout = null;
		}
	}

	async saveSettings() {
		await this.savePluginData();
	}

	private async savePluginData(): Promise<void> {
		const data: PluginData = {
			settings: this.settings,
			activeWorkout: this.activeWorkout,
		};
		await this.saveData(data);
	}
}
