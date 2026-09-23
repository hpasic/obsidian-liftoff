/*
 * Print the CHANGELOG.md section body for a version — the GitHub release notes.
 * Exits non-zero when the section is missing so a release can't ship without one.
 *
 *   node scripts/changelog-notes.mjs 0.5.1
 *
 * Needs Node >= 22.18 (native TypeScript type stripping) to load the parser the
 * plugin itself uses.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findSection, parseChangelog } from "../src/utils/changelog.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , version] = process.argv;
if (!version) {
	console.error("usage: node scripts/changelog-notes.mjs <version>");
	process.exit(2);
}

const section = findSection(parseChangelog(readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8")), version);
if (!section || !section.body) {
	console.error(`CHANGELOG.md has no "## ${version} - <date>" section with notes`);
	process.exit(1);
}
process.stdout.write(section.body + "\n");
