import { App, Component, MarkdownRenderer, Modal } from "obsidian";
import type { LiftOffSettings } from "../types";
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
 * After an update, show the notes for every version since the one the user last
 * saw, once. A first install only records the version. The version is recorded
 * even when the "Show what's new" toggle is off.
 */
export async function showWhatsNewIfUpdated(
	app: App,
	settings: LiftOffSettings,
	currentVersion: string,
	changelog: string,
	save: () => Promise<void>
): Promise<void> {
	const lastSeen = settings.lastSeenVersion;
	if (lastSeen !== undefined && compareVersions(currentVersion, lastSeen) <= 0) return;

	if (lastSeen !== undefined && settings.showWhatsNew) {
		const sections = sectionsSince(parseChangelog(changelog), lastSeen, currentVersion, MAX_SECTIONS);
		if (sections.length > 0) new WhatsNewModal(app, currentVersion, sections).open();
	}
	settings.lastSeenVersion = currentVersion;
	await save();
}
