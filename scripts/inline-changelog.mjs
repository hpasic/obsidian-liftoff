/*
 * What the plugin bundle inlines as LIFTOFF_CHANGELOG: the newest sections of
 * CHANGELOG.md only (the "What's new" window never shows more). Shared by
 * esbuild.config.mjs and vitest.config.ts so tests see exactly what ships.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions, parseChangelog } from "../src/utils/changelog.ts";

export const INLINED_SECTIONS = 3;

const CHANGELOG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../CHANGELOG.md");

/** The newest `count` version sections, re-emitted in CHANGELOG.md's own format. */
export function selectInlinedChangelog(markdown, count = INLINED_SECTIONS) {
	return parseChangelog(markdown)
		.sort((a, b) => compareVersions(b.version, a.version))
		.slice(0, count)
		.map((s) => `## ${s.version}${s.date ? ` - ${s.date}` : ""}\n\n${s.body}`)
		.join("\n\n") + "\n";
}

export function readInlinedChangelog() {
	return selectInlinedChangelog(readFileSync(CHANGELOG_PATH, "utf8"));
}
