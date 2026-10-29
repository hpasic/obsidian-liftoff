// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import "./helpers/dom";
import LiftOffPlugin from "../src/main";
import { LAST_SEEN_VERSION_KEY } from "../src/components/whats-new-modal";
import { DEFAULT_SETTINGS, type Workout } from "../src/types";

async function loadPlugin(data: unknown, marker?: string) {
	const storage = new Map<string, unknown>(marker ? [[LAST_SEEN_VERSION_KEY, marker]] : []);
	const layoutReady: (() => void)[] = [];
	const app = {
		workspace: { onLayoutReady: (cb: () => void) => layoutReady.push(cb) },
		loadLocalStorage: (key: string) => storage.get(key) ?? null,
		saveLocalStorage: (key: string, value: unknown) => void storage.set(key, value),
	};
	const manifest = { version: "0.5.1" };
	const plugin = new LiftOffPlugin(app as never, manifest as never);
	const saveData = vi.fn().mockResolvedValue(undefined);
	// The Plugin mock is bare; give this instance the surface onload uses
	Object.assign(plugin, {
		app,
		manifest,
		loadData: vi.fn().mockResolvedValue(data),
		saveData,
		registerView: vi.fn(),
		addSettingTab: vi.fn(),
		addRibbonIcon: vi.fn(),
		addCommand: vi.fn(),
	});
	await plugin.onload();
	// Nothing opens before the layout is ready
	expect(document.querySelector(".ln-whats-new")).toBeNull();
	for (const cb of layoutReady) cb();
	return { saveData, marker: storage.get(LAST_SEEN_VERSION_KEY), modal: document.querySelector(".ln-whats-new") };
}

describe("LiftOffPlugin load", () => {
	it("first install: no window, per-device marker recorded, data.json untouched", async () => {
		const { saveData, marker, modal } = await loadPlugin(null);
		expect(modal).toBeNull();
		expect(marker).toBe("0.5.1");
		expect(saveData).not.toHaveBeenCalled();
	});

	it("upgrade from an install with data but no marker shows 0.5.1 without writing data.json", async () => {
		const data = { settings: { ...DEFAULT_SETTINGS, exerciseLibrary: [] }, activeWorkout: null };
		const { saveData, marker, modal } = await loadPlugin(data);
		expect(modal?.querySelector("h3")?.textContent).toBe("What's new in LiftOff 0.5.1");
		expect(marker).toBe("0.5.1");
		expect(saveData).not.toHaveBeenCalled();
	});

	it("respects the toggle stored in data.json", async () => {
		const data = { settings: { ...DEFAULT_SETTINGS, showWhatsNew: false }, activeWorkout: null };
		const { saveData, marker, modal } = await loadPlugin(data, "0.5.0");
		expect(modal).toBeNull();
		expect(marker).toBe("0.5.1");
		expect(saveData).not.toHaveBeenCalled();
	});
});

describe("LiftOffPlugin active workout persistence", () => {
	it("saves and reloads timer start markers outside the workout note data", async () => {
		const plugin = new LiftOffPlugin({} as never, {} as never);
		const saveData = vi.fn().mockResolvedValue(undefined);
		Object.assign(plugin, { saveData });
		const workout: Workout = {
			type: "workout", template: null, date: "2026-09-21", start: "12:00",
			end: null, duration: null,
			exercises: [{ name: "Tabata", exerciseType: "timer", sets: [], workSeconds: 40, restSeconds: 20, intervals: 3 }],
		};
		await plugin.persistActiveWorkout(workout, Date.now(), [0]);
		const data = JSON.parse(JSON.stringify(saveData.mock.calls[0]![0]));
		expect(data.activeWorkout).toEqual({ workout, startTimeMs: Date.now(), startedTimerIndices: [0] });
		expect(data.activeWorkout.workout).not.toHaveProperty("startedTimerIndices");
		const restored = new LiftOffPlugin({} as never, {} as never);
		Object.assign(restored, { loadData: vi.fn().mockResolvedValue(data) });
		await restored.loadPluginData();
		expect(restored.activeWorkout).toEqual(data.activeWorkout);
		await plugin.persistActiveWorkout(workout, Date.now());
		expect(plugin.activeWorkout?.startedTimerIndices).toEqual([]);
	});
});
