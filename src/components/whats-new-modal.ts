import { App, Component, MarkdownRenderer, Modal, requireApiVersion } from "obsidian";
import { compareVersions, parseChangelog, sectionsSince, type ChangelogSection } from "../utils/changelog";

/** Most versions shown at once after a long gap between updates. */
const MAX_SECTIONS = 3;

export class WhatsNewModal extends Modal {
	private component = new Component();

	constructor(
		app: App,
		private version: string,
		private sections: ChangelogSection[]
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ln-whats-new");
		contentEl.createEl("h3", { text: `What's new in LiftOff ${this.version}` });

		// One section reads as-is; several get a heading per version
		const markdown = this.sections.length === 1
			? this.sections[0]!.body
			: this.sections.map((s) => `### ${s.version}\n\n${s.body}`).join("\n\n");
		const bodyEl = contentEl.createDiv({ cls: "ln-whats-new-body" });
		this.component.load();
		void MarkdownRenderer.render(this.app, markdown, bodyEl, "", this.component);

		const buttons = contentEl.createDiv({ cls: "ln-modal-buttons" });
		buttons.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.component.unload();
		this.contentEl.empty();
	}
}

/**
 * Per-device marker of the version whose notes were seen. Kept in the vault's
 * localStorage, not data.json: each device shows the window once, and startup
 * never rewrites a synced data.json.
 */
export const LAST_SEEN_VERSION_KEY = "liftoff-last-seen-version";

/**
 * After an update, show the notes for every version since the one this device
 * last saw, once.
 * - No data.json and no marker: first install — record the version, show nothing.
 * - data.json but no marker: upgrade from an unknown version — show the current notes.
 * - Older marker: show every version since it (newest first, capped).
 * The marker is recorded even when `showWhatsNew` is off.
 */
export function showWhatsNewIfUpdated(
	app: App,
	options: { hadSavedData: boolean; showWhatsNew: boolean },
	currentVersion: string,
	changelog: string
): void {
	// Vault localStorage needs Obsidian 1.8.7+; older versions just skip the window
	if (requireApiVersion("1.8.7")) {
		const stored: unknown = app.loadLocalStorage(LAST_SEEN_VERSION_KEY);
		const lastSeen = typeof stored === "string" ? stored : null;
		if (lastSeen !== null && compareVersions(currentVersion, lastSeen) <= 0) return;

		if (options.showWhatsNew && (lastSeen !== null || options.hadSavedData)) {
			const sections = parseChangelog(changelog);
			const shown = lastSeen !== null
				? sectionsSince(sections, lastSeen, currentVersion, MAX_SECTIONS)
				: sections.filter((s) => compareVersions(s.version, currentVersion) === 0);
			if (shown.length > 0) new WhatsNewModal(app, currentVersion, shown).open();
		}
		app.saveLocalStorage(LAST_SEEN_VERSION_KEY, currentVersion);
	}
}
