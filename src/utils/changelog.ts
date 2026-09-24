// No imports and only erasable TypeScript: scripts/changelog-notes.mjs loads
// this file directly with Node's type stripping, so the release workflow and
// the plugin share one parser.

export interface ChangelogSection {
	version: string;
	date: string;
	/** Markdown under the heading, trimmed. */
	body: string;
}

const HEADING = /^## (\d+(?:\.\d+)*)(?: - (\S+))?[ \t]*$/;

/** `## 0.5.1 - 2026-09-23` sections, in file order (newest first by convention). */
export function parseChangelog(markdown: string): ChangelogSection[] {
	const sections: ChangelogSection[] = [];
	let current: { version: string; date: string; lines: string[] } | null = null;
	const flush = () => {
		if (current) sections.push({ version: current.version, date: current.date, body: current.lines.join("\n").trim() });
	};
	for (const line of markdown.split(/\r?\n/)) {
		const match = HEADING.exec(line);
		if (match) {
			flush();
			current = { version: match[1]!, date: match[2] ?? "", lines: [] };
		} else if (line.startsWith("## ")) {
			flush();
			current = null; // an unrecognised section ends the previous one
		} else {
			current?.lines.push(line);
		}
	}
	flush();
	return sections;
}

/** Numeric dotted-version compare: 0.10.0 > 0.9.9, 1.0 == 1.0.0. */
export function compareVersions(a: string, b: string): number {
	const x = a.split(".").map((part) => parseInt(part, 10) || 0);
	const y = b.split(".").map((part) => parseInt(part, 10) || 0);
	for (let i = 0; i < Math.max(x.length, y.length); i++) {
		const diff = (x[i] ?? 0) - (y[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export function findSection(sections: ChangelogSection[], version: string): ChangelogSection | undefined {
	return sections.find((s) => compareVersions(s.version, version) === 0);
}

/** Sections in (lastSeen, current], newest first, at most `cap`. */
export function sectionsSince(
	sections: ChangelogSection[],
	lastSeen: string,
	current: string,
	cap = 3
): ChangelogSection[] {
	return sections
		.filter((s) => compareVersions(s.version, lastSeen) > 0 && compareVersions(s.version, current) <= 0)
		.sort((a, b) => compareVersions(b.version, a.version))
		.slice(0, cap);
}
