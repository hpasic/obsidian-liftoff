import { App, PluginSettingTab, Setting } from "obsidian";
import type LiftOffPlugin from "./main";

export class LiftOffSettingTab extends PluginSettingTab {
	plugin: LiftOffPlugin;

	constructor(app: App, plugin: LiftOffPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

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
						const presets = value
							.split(",")
							.map((s) => parseInt(s.trim(), 10))
							.filter((n) => !isNaN(n) && n > 0);
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
