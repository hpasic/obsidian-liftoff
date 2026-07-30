import { App, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import type { LiftOffSettings } from "./types";
import type LiftOffPlugin from "./main";

function parseRestTimerPresets(value: string): number[] {
	return value
		.split(",")
		.map((s) => parseInt(s.trim(), 10))
		.filter((n) => !isNaN(n) && n > 0);
}

export class LiftOffSettingTab extends PluginSettingTab {
	plugin: LiftOffPlugin;

	constructor(app: App, plugin: LiftOffPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Workout folder",
				desc: "Folder where workout notes are saved",
				control: { type: "text", key: "workoutFolder", placeholder: "Workouts" },
			},
			{
				name: "Template folder",
				desc: "Folder where workout templates are stored",
				control: { type: "text", key: "templateFolder", placeholder: "Workout templates" },
			},
			{
				name: "Weight unit",
				desc: "Default weight unit for new sets",
				control: {
					type: "dropdown",
					key: "weightUnit",
					options: { kg: "Kilograms (kg)", lbs: "Pounds (lbs)" },
				},
			},
			{
				name: "Rest timer presets",
				desc: "Comma-separated list of rest timer durations in seconds",
				control: {
					type: "text",
					key: "restTimerPresets",
					placeholder: "30, 60, 90, 120",
					validate: (value) =>
						parseRestTimerPresets(value).length > 0
							? undefined
							: "Enter a comma-separated list of seconds, e.g. 30, 60, 90.",
				},
			},
			{
				name: "Default rest duration",
				desc: "Default rest timer duration in seconds",
				control: { type: "number", key: "defaultRestDuration", placeholder: "90", min: 1, step: 1 },
			},
			{
				type: "group",
				heading: "Timer exercises",
				items: [
					{
						name: "Default work duration",
						desc: "Default work phase duration in seconds for timer exercises",
						control: {
							type: "number",
							key: "defaultWorkDuration",
							placeholder: "40",
							min: 1,
							step: 1,
						},
					},
					{
						name: "Default rest interval duration",
						desc: "Default rest phase duration in seconds for timer exercises",
						control: {
							type: "number",
							key: "defaultRestIntervalDuration",
							placeholder: "20",
							min: 1,
							step: 1,
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === "restTimerPresets") {
			return this.plugin.settings.restTimerPresets.join(", ");
		}
		return this.plugin.settings[key as keyof LiftOffSettings];
	}

	setControlValue(key: string, value: unknown): void | Promise<void> {
		const settings = this.plugin.settings;
		switch (key) {
			case "workoutFolder":
				settings.workoutFolder = String(value);
				break;
			case "templateFolder":
				settings.templateFolder = String(value);
				break;
			case "weightUnit":
				if (value !== "kg" && value !== "lbs") return;
				settings.weightUnit = value;
				break;
			case "restTimerPresets": {
				const presets = parseRestTimerPresets(String(value));
				if (presets.length === 0) return;
				settings.restTimerPresets = presets;
				break;
			}
			case "defaultRestDuration":
			case "defaultWorkDuration":
			case "defaultRestIntervalDuration": {
				const num = typeof value === "number" ? Math.floor(value) : NaN;
				if (!Number.isFinite(num) || num <= 0) return;
				settings[key] = num;
				break;
			}
			default:
				return;
		}
		return this.plugin.saveSettings();
	}

	// Fallback for Obsidian < 1.13.0 only — never called on newer versions,
	// where the tab renders declaratively from getSettingDefinitions().
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Workout folder")
			.setDesc("Folder where workout notes are saved")
			.addText((text) =>
				text
					.setPlaceholder("Workouts")
					.setValue(this.plugin.settings.workoutFolder)
					.onChange(async (value) => {
						this.plugin.settings.workoutFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Template folder")
			.setDesc("Folder where workout templates are stored")
			.addText((text) =>
				text
					.setPlaceholder("Workout templates")
					.setValue(this.plugin.settings.templateFolder)
					.onChange(async (value) => {
						this.plugin.settings.templateFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Weight unit")
			.setDesc("Default weight unit for new sets")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("kg", "Kilograms (kg)")
					.addOption("lbs", "Pounds (lbs)")
					.setValue(this.plugin.settings.weightUnit)
					.onChange(async (value: "kg" | "lbs") => {
						this.plugin.settings.weightUnit = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Rest timer presets")
			.setDesc("Comma-separated list of rest timer durations in seconds")
			.addText((text) =>
				text
					.setPlaceholder("30, 60, 90, 120")
					.setValue(this.plugin.settings.restTimerPresets.join(", "))
					.onChange(async (value) => {
						const presets = parseRestTimerPresets(value);
						if (presets.length > 0) {
							this.plugin.settings.restTimerPresets = presets;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Default rest duration")
			.setDesc("Default rest timer duration in seconds")
			.addText((text) =>
				text
					.setPlaceholder("90")
					.setValue(String(this.plugin.settings.defaultRestDuration))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultRestDuration = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl).setName("Timer exercises").setHeading();

		new Setting(containerEl)
			.setName("Default work duration")
			.setDesc("Default work phase duration in seconds for timer exercises")
			.addText((text) =>
				text
					.setPlaceholder("40")
					.setValue(String(this.plugin.settings.defaultWorkDuration))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultWorkDuration = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Default rest interval duration")
			.setDesc("Default rest phase duration in seconds for timer exercises")
			.addText((text) =>
				text
					.setPlaceholder("20")
					.setValue(String(this.plugin.settings.defaultRestIntervalDuration))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.defaultRestIntervalDuration = num;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
