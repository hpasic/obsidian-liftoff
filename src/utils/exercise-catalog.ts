import {
	CATALOG_BODY_PARTS,
	CATALOG_EQUIPMENT,
	CATALOG_MUSCLES,
	CATALOG_ROWS,
} from "../data/exercise-catalog";
import type { ExerciseType } from "../types";

export interface CatalogExercise {
	name: string;
	bodyPart: string;
	equipment: string;
	target: string;
	secondaryMuscles: string[];
	exerciseType: ExerciseType;
	/** Lower-cased "name target equipment body part", precomputed once for search. */
	haystack: string;
}

let decoded: CatalogExercise[] | null = null;
let byName: Map<string, CatalogExercise> | null = null;
let bodyParts: string[] | null = null;

function lookup(table: string[], index: string): string {
	return table[Number(index)] ?? "other";
}

function decode(): CatalogExercise[] {
	return CATALOG_ROWS.split("\n").map((row) => {
		const [name = "", bodyPart = "", equipment = "", target = "", secondary = "", duration = "0"] =
			row.split("|");
		const exercise: CatalogExercise = {
			name,
			bodyPart: lookup(CATALOG_BODY_PARTS, bodyPart),
			equipment: lookup(CATALOG_EQUIPMENT, equipment),
			target: lookup(CATALOG_MUSCLES, target),
			secondaryMuscles: secondary
				? secondary.split(",").map((index) => lookup(CATALOG_MUSCLES, index))
				: [],
			exerciseType: duration === "1" ? "duration" : "weight",
			haystack: "",
		};
		exercise.haystack =
			`${name} ${exercise.target} ${exercise.equipment} ${exercise.bodyPart}`.toLowerCase();
		return exercise;
	});
}

/** The bundled catalog, decoded on first use (the picker is the only caller). */
export function getCatalog(): CatalogExercise[] {
	if (decoded === null) decoded = decode();
	return decoded;
}

/**
 * Catalog rows keyed by trimmed lower-cased name. Lets a library entry that
 * shares a catalog name borrow its metadata for search and chip filtering.
 */
export function getCatalogByName(): Map<string, CatalogExercise> {
	if (byName === null) {
		byName = new Map(getCatalog().map((exercise) => [normalizeName(exercise.name), exercise]));
	}
	return byName;
}

/** Shared key for every name comparison between the library and the catalog. */
export function normalizeName(name: string): string {
	return name.trim().toLowerCase();
}

/** Body parts present in the catalog, most populated first — chip order. */
export function getCatalogBodyParts(): string[] {
	if (bodyParts === null) {
		const counts = new Map<string, number>();
		for (const exercise of getCatalog()) {
			counts.set(exercise.bodyPart, (counts.get(exercise.bodyPart) ?? 0) + 1);
		}
		bodyParts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([part]) => part);
	}
	return bodyParts;
}
