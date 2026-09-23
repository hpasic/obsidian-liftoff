// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { showWhatsNewIfUpdated } from "../../src/components/whats-new-modal";
import { DEFAULT_SETTINGS, type LiftOffSettings } from "../../src/types";
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

function settings(extra: Partial<LiftOffSettings> = {}): LiftOffSettings {
	return { ...DEFAULT_SETTINGS, exerciseLibrary: [], ...extra };
}

const modal = () => document.querySelector<HTMLElement>(".ln-whats-new");

async function load(s: LiftOffSettings, version: string) {
	const save = vi.fn().mockResolvedValue(undefined);
	await showWhatsNewIfUpdated({} as never, s, version, changelog, save);
	return save;
}

describe("What's new after an update", () => {
	it("records the version silently on first install", async () => {
		const s = settings();
		const save = await load(s, "0.5.1");
		expect(modal()).toBeNull();
		expect(s.lastSeenVersion).toBe("0.5.1");
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("shows the notes since the last seen version once, then never again for that version", async () => {
		const s = settings({ lastSeenVersion: "0.5.0" });
		const save = await load(s, "0.5.1");
		const root = modal()!;
		expect(element(root, "h3").textContent).toBe("What's new in LiftOff 0.5.1");
		expect(element(root, ".ln-whats-new-body").textContent).toBe("- Five one");
		expect(s.lastSeenVersion).toBe("0.5.1");
		expect(save).toHaveBeenCalledTimes(1);

		click(root, ".ln-modal-buttons .mod-cta");
		expect(root.isConnected).toBe(false);

		const again = await load(s, "0.5.1");
		expect(modal()).toBeNull();
		expect(again).not.toHaveBeenCalled();
	});

	it("caps a long gap at the three newest versions, each under its own heading", async () => {
		const s = settings({ lastSeenVersion: "0.3.0" });
		await load(s, "0.6.0");
		const body = element(modal()!, ".ln-whats-new-body").textContent;
		expect(body).toBe("### 0.6.0\n\n- Six\n\n### 0.5.1\n\n- Five one\n\n### 0.5.0\n\n- Five");
		click(modal()!, ".mod-cta");
	});

	it("records the version but shows nothing when the toggle is off", async () => {
		const s = settings({ lastSeenVersion: "0.5.0", showWhatsNew: false });
		const save = await load(s, "0.5.1");
		expect(modal()).toBeNull();
		expect(s.lastSeenVersion).toBe("0.5.1");
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("does nothing on a downgrade", async () => {
		const s = settings({ lastSeenVersion: "0.6.0" });
		const save = await load(s, "0.5.1");
		expect(modal()).toBeNull();
		expect(s.lastSeenVersion).toBe("0.6.0");
		expect(save).not.toHaveBeenCalled();
	});
});
