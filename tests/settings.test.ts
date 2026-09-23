import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type LiftOffPlugin from "../src/main";
import { LiftOffSettingTab } from "../src/settings";
import { DEFAULT_SETTINGS } from "../src/types";

function setup() {
	const plugin = { settings: { ...DEFAULT_SETTINGS }, saveSettings: vi.fn().mockResolvedValue(undefined) };
	return { plugin, tab: new LiftOffSettingTab({} as App, plugin as unknown as LiftOffPlugin) };
}

describe("hold buffer setting", () => {
	it("accepts 0 to 60 seconds and rejects anything else", async () => {
		const { plugin, tab } = setup();
		await tab.setControlValue("holdBufferSeconds", 0);
		expect(plugin.settings.holdBufferSeconds).toBe(0);
		await tab.setControlValue("holdBufferSeconds", 60);
		expect(plugin.settings.holdBufferSeconds).toBe(60);
		await tab.setControlValue("holdBufferSeconds", 61);
		await tab.setControlValue("holdBufferSeconds", -1);
		expect(plugin.settings.holdBufferSeconds).toBe(60);
		expect(plugin.saveSettings).toHaveBeenCalledTimes(2);
	});

	it("declares the same bounds to the settings UI", () => {
		const { tab } = setup();
		const item = tab.getSettingDefinitions().find((d) => "control" in d && d.control?.key === "holdBufferSeconds");
		expect(item).toMatchObject({ control: { type: "number", min: 0, max: 60 } });
	});
});

describe("what's new setting", () => {
	it("shows a default-on toggle and never exposes the last seen version", async () => {
		const { plugin, tab } = setup();
		expect(plugin.settings.showWhatsNew).toBe(true);
		const defs = tab.getSettingDefinitions();
		expect(defs).toContainEqual(expect.objectContaining({
			name: "Show what's new after updates",
			control: { type: "toggle", key: "showWhatsNew" },
		}));
		expect(JSON.stringify(defs)).not.toContain("lastSeenVersion");
		await tab.setControlValue("showWhatsNew", false);
		expect(plugin.settings.showWhatsNew).toBe(false);
		await tab.setControlValue("lastSeenVersion", "9.9.9");
		expect(plugin.settings.lastSeenVersion).toBeUndefined();
	});
});

