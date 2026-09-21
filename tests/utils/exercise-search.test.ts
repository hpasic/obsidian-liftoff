import { describe, expect, it } from "vitest";
import { getCatalog, getCatalogBodyParts, type CatalogExercise } from "../../src/utils/exercise-catalog";
import { filterCatalog, matchesTokens, tokenizeQuery } from "../../src/utils/exercise-search";

function entry(name: string, target: string, equipment: string, bodyPart = "chest"): CatalogExercise {
	return {
		name,
		bodyPart,
		equipment,
		target,
		secondaryMuscles: [],
		exerciseType: "weight",
		haystack: `${name} ${target} ${equipment}`.toLowerCase(),
	};
}

const sample = [
	entry("Barbell bench press", "pectorals", "barbell"),
	entry("Dumbbell curl", "biceps", "dumbbell", "upper arms"),
	entry("Cable crossover", "pectorals", "cable"),
];

describe("tokenizeQuery", () => {
	it("lower-cases and drops empty words", () => {
		expect(tokenizeQuery("  Bench   PRESS ")).toEqual(["bench", "press"]);
		expect(tokenizeQuery("   ")).toEqual([]);
	});
});

describe("matchesTokens", () => {
	it("requires every token to match somewhere (AND, not OR)", () => {
		expect(matchesTokens("barbell bench press pectorals", ["bench", "barbell"])).toBe(true);
		expect(matchesTokens("barbell bench press pectorals", ["bench", "cable"])).toBe(false);
	});

	it("matches partial tokens as substrings", () => {
		expect(matchesTokens("barbell bench press pectorals", ["ben", "pre"])).toBe(true);
	});

	it("expands gym shorthand", () => {
		expect(matchesTokens("dumbbell curl biceps dumbbell", ["db", "curl"])).toBe(true);
		expect(matchesTokens("barbell curl biceps barbell", ["db", "curl"])).toBe(false);
	});

	it("matches everything when there is no query", () => {
		expect(matchesTokens("anything", [])).toBe(true);
	});
});

describe("filterCatalog", () => {
	const anything = { tokens: [], bodyPart: null, excludeNames: new Set<string>(), limit: 50 };

	it("filters by body-part chip", () => {
		const { items } = filterCatalog(sample, { ...anything, bodyPart: "upper arms" });
		expect(items.map((e) => e.name)).toEqual(["Dumbbell curl"]);
	});

	it("drops names the user already has, case-insensitively", () => {
		const { items, total } = filterCatalog(sample, {
			...anything,
			excludeNames: new Set(["barbell bench press"]),
		});
		expect(items.map((e) => e.name)).toEqual(["Dumbbell curl", "Cable crossover"]);
		expect(total).toBe(2);
	});

	it("searches equipment and target as well as name", () => {
		expect(filterCatalog(sample, { ...anything, tokens: ["cable"] }).items).toHaveLength(1);
		expect(filterCatalog(sample, { ...anything, tokens: ["pectorals"] }).items).toHaveLength(2);
	});

	it("caps rendered items but reports the full match count", () => {
		const { items, total } = filterCatalog(sample, { ...anything, limit: 2 });
		expect(items).toHaveLength(2);
		expect(total).toBe(3);
	});

	it("ranks name hits above target/equipment hits, shortest name first", () => {
		const ranked = [
			entry("Standing fly", "pectorals", "cable"), // only the equipment matches
			entry("Cable crossover machine fly", "pectorals", "cable"),
			entry("Cable fly", "pectorals", "cable"),
		];
		const { items } = filterCatalog(ranked, { ...anything, tokens: ["cable"] });
		expect(items.map((e) => e.name)).toEqual([
			"Cable fly",
			"Cable crossover machine fly",
			"Standing fly",
		]);
	});

	it("keeps catalog order when there is no query", () => {
		const { items } = filterCatalog(sample, { ...anything });
		expect(items.map((e) => e.name)).toEqual(sample.map((e) => e.name));
	});
});

describe("bundled catalog", () => {
	it("decodes every row with resolved lookup fields", () => {
		const catalog = getCatalog();
		expect(catalog.length).toBeGreaterThan(1000);
		for (const exercise of catalog) {
			expect(exercise.name).not.toBe("");
			expect(exercise.bodyPart).not.toBe("other");
			expect(exercise.equipment).not.toBe("other");
			expect(exercise.target).not.toBe("other");
		}
	});

	it("has unique names and a body-part chip list", () => {
		const names = getCatalog().map((e) => e.name.toLowerCase());
		expect(new Set(names).size).toBe(names.length);
		expect(getCatalogBodyParts()).toContain("chest");
	});

	it("finds a real exercise from shorthand", () => {
		const { items } = filterCatalog(getCatalog(), {
			tokens: tokenizeQuery("db bench press"),
			bodyPart: null,
			excludeNames: new Set(),
			limit: 50,
		});
		expect(items.some((e) => e.name === "Dumbbell bench press")).toBe(true);
	});
});
