// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { setApiVersion } from "../mocks/obsidian";
import { LAST_SEEN_VERSION_KEY, showWhatsNewIfUpdated } from "../../src/components/whats-new-modal";
import { click, element } from "../helpers/dom";

const changelog = `# Changelog

## 0.6.0 - 2026-10-10

- Six

## 0.5.1 - 2026-09-23

- Five one

## 0.5.0 - 2026-09-20

- Five

## 0.4.0 - 2026-09-01

- Four

## 0.3.0 - 2026-08-01

- Three
`;

/** One device: its vault-scoped localStorage. */
function device(lastSeen?: string) {
	const storage = new Map<string, unknown>();
	if (lastSeen !== undefined) storage.set(LAST_SEEN_VERSION_KEY, lastSeen);
	const app = {
		loadLocalStorage: (key: string) => storage.get(key) ?? null,
		saveLocalStorage: (key: string, value: unknown) => void storage.set(key, value),
	};
	return { app, marker: () => storage.get(LAST_SEEN_VERSION_KEY) };
}

const modal = () => document.querySelector<HTMLElement>(".ln-whats-new");
const body = () => element(modal()!, ".ln-whats-new-body").textContent;

function load(d: ReturnType<typeof device>, version: string, hadSavedData = true, showWhatsNew = true) {
	showWhatsNewIfUpdated(d.app as never, { hadSavedData, showWhatsNew }, version, changelog);
}

afterEach(() => setApiVersion("1.13.1"));

describe("What's new after an update", () => {
	it("records the version silently on a first install (no data.json, no marker)", () => {
		const d = device();
		load(d, "0.5.1", false);
		expect(modal()).toBeNull();
		expect(d.marker()).toBe("0.5.1");
	});

	it("treats existing data without a marker as an upgrade and shows only the current notes", () => {
		const d = device();
		load(d, "0.5.1", true);
		expect(element(modal()!, "h3").textContent).toBe("What's new in LiftOff 0.5.1");
		expect(body()).toBe("- Five one");
		expect(d.marker()).toBe("0.5.1");
	});

	it("shows the notes since this device's marker once, then never again for that version", () => {
		const d = device("0.5.0");
		load(d, "0.5.1");
		expect(body()).toBe("- Five one");
		expect(d.marker()).toBe("0.5.1");
		click(modal()!, ".ln-modal-buttons .mod-cta");
		expect(modal()).toBeNull();

		load(d, "0.5.1");
		expect(modal()).toBeNull();
	});

	it("keeps the marker per device: a second device still gets its own window", () => {
		const phone = device("0.5.0");
		const laptop = device("0.5.0");
		load(phone, "0.5.1");
		click(modal()!, ".mod-cta");
		load(laptop, "0.5.1");
		expect(body()).toBe("- Five one");
		expect(laptop.marker()).toBe("0.5.1");
	});

	it("caps a long gap at the three newest versions, each under its own heading", () => {
		load(device("0.3.0"), "0.6.0");
		expect(body()).toBe("### 0.6.0\n\n- Six\n\n### 0.5.1\n\n- Five one\n\n### 0.5.0\n\n- Five");
	});

	it("records the marker but shows nothing when the toggle is off", () => {
		const d = device("0.5.0");
		load(d, "0.5.1", true, false);
		expect(modal()).toBeNull();
		expect(d.marker()).toBe("0.5.1");
	});

	it("does nothing on a downgrade", () => {
		const d = device("0.6.0");
		load(d, "0.5.1");
		expect(modal()).toBeNull();
		expect(d.marker()).toBe("0.6.0");
	});

	it("skips everything on Obsidian versions without vault localStorage", () => {
		setApiVersion("1.8.6");
		const d = device();
		const app = { loadLocalStorage: () => { throw new Error("missing"); }, saveLocalStorage: () => { throw new Error("missing"); } };
		expect(() => showWhatsNewIfUpdated(app as never, { hadSavedData: true, showWhatsNew: true }, "0.5.1", changelog)).not.toThrow();
		expect(modal()).toBeNull();
		expect(d.marker()).toBeUndefined();
	});
});
