import { describe, expect, it } from "vitest";
import { CATALOG_ROWS } from "../../src/data/exercise-catalog";

function compareCodePoints(a: string, b: string): number {
	const x = Array.from(a, (ch) => ch.codePointAt(0)!);
	const y = Array.from(b, (ch) => ch.codePointAt(0)!);
	for (let i = 0; i < Math.min(x.length, y.length); i++) {
		if (x[i] !== y[i]) return x[i]! - y[i]!;
	}
	return x.length - y.length;
}

describe("generated exercise catalog", () => {
	it("is in locale-independent code-point order", () => {
		const names = CATALOG_ROWS.split("\n").map((row) => row.split("|")[0]!);
		expect(names.length).toBeGreaterThan(1000);
		expect(names).toEqual([...names].sort(compareCodePoints));
		// localeCompare ignores the comma here; code points do not
		expect(names.indexOf("Crunch (on stability ball)")).toBeLessThan(
			names.indexOf("Crunch (on stability ball, arms straight)"));
	});
});
