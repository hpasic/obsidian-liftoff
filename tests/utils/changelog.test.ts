import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { compareVersions, findSection, parseChangelog, sectionsSince } from "../../src/utils/changelog";
import { readInlinedChangelog, selectInlinedChangelog } from "../../scripts/inline-changelog.mjs";

const changelog = readFileSync("CHANGELOG.md", "utf8");
const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as { version: string };

const sample = `# Changelog

Intro text is ignored.

## 0.10.0 - 2026-10-01

- Ten

## 0.9.0 - 2026-09-30

- Nine
- More nine

## Unreleased notes

- not a version

## 0.8.0

- Eight, undated
`;

describe("parseChangelog", () => {
	it("splits version sections with dates and trimmed bodies, skipping other headings", () => {
		expect(parseChangelog(sample)).toEqual([
			{ version: "0.10.0", date: "2026-10-01", body: "- Ten" },
			{ version: "0.9.0", date: "2026-09-30", body: "- Nine\n- More nine" },
			{ version: "0.8.0", date: "", body: "- Eight, undated" },
		]);
	});
});

describe("compareVersions", () => {
	it("compares numerically, not as strings", () => {
		expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
		expect(compareVersions("0.5.0", "0.5.1")).toBeLessThan(0);
		expect(compareVersions("1.0", "1.0.0")).toBe(0);
	});
});

describe("sectionsSince", () => {
	const sections = parseChangelog(sample);
	it("returns versions after lastSeen up to current, newest first", () => {
		expect(sectionsSince(sections, "0.8.0", "0.10.0").map((s) => s.version)).toEqual(["0.10.0", "0.9.0"]);
		expect(sectionsSince(sections, "0.8.0", "0.9.0").map((s) => s.version)).toEqual(["0.9.0"]);
		expect(sectionsSince(sections, "0.10.0", "0.10.0")).toEqual([]);
	});

	it("caps the number of sections", () => {
		expect(sectionsSince(sections, "0.1.0", "0.10.0", 2).map((s) => s.version)).toEqual(["0.10.0", "0.9.0"]);
	});
});

describe("CHANGELOG.md", () => {
	it("has a dated, non-empty section for the version in manifest.json", () => {
		const section = findSection(parseChangelog(changelog), manifest.version);
		expect(section, `CHANGELOG.md needs a "## ${manifest.version} - <date>" section`).toBeDefined();
		expect(section!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(section!.body).toMatch(/^- /);
	});

	it("keeps every release since 0.4.0, newest first", () => {
		const versions = parseChangelog(changelog).map((s) => s.version);
		expect(versions).toEqual(expect.arrayContaining(["0.4.0", "0.5.0"]));
		expect(versions).toEqual([...versions].sort((a, b) => compareVersions(b, a)));
	});

	it("is what the plugin build inlines: its newest three sections, unchanged", () => {
		const inlined = readInlinedChangelog();
		expect(LIFTOFF_CHANGELOG).toBe(inlined);
		const newest = parseChangelog(changelog)
			.sort((a, b) => compareVersions(b.version, a.version)).slice(0, 3);
		expect(parseChangelog(inlined)).toEqual(newest);
	});
});

describe("scripts/changelog-notes.mjs", () => {
	const run = (version: string) => spawnSync(process.execPath, ["scripts/changelog-notes.mjs", version], { encoding: "utf8" });

	it("prints the section body used as the release notes", () => {
		const result = run(manifest.version);
		expect(result.status).toBe(0);
		expect(result.stdout).toBe(findSection(parseChangelog(changelog), manifest.version)!.body + "\n");
	});

	it("fails when the version has no section", () => {
		const result = run("99.0.0");
		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("99.0.0");
	});
});

describe("selectInlinedChangelog", () => {
	it("keeps only the newest sections, highest version first, dropping the intro", () => {
		const inlined = selectInlinedChangelog(sample, 2);
		expect(inlined).toBe("## 0.10.0 - 2026-10-01\n\n- Ten\n\n## 0.9.0 - 2026-09-30\n\n- Nine\n- More nine\n");
		expect(inlined).not.toContain("Intro");
		expect(parseChangelog(selectInlinedChangelog(sample)).map((s) => s.version)).toEqual(["0.10.0", "0.9.0", "0.8.0"]);
	});
});

