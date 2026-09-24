/*
 * Regenerates src/data/exercise-catalog.ts from the exercises dataset at
 * https://github.com/hasaneyldrm/exercises-dataset (file: data/exercises.json —
 * a JSON array with id, name, body_part, equipment, target, secondary_muscles,
 * ...). Offline — takes the dataset path as an argument.
 *
 *   node scripts/build-exercise-catalog.mjs /path/to/exercises.json
 *
 * Output is one newline-delimited string plus three lookup tables: the plugin
 * ships a single compact literal and decodes it lazily the first time the
 * picker opens. Dropped on purpose: `category` (duplicate of body_part),
 * `muscle_group` (noisy free text), instructions, and all media fields.
 */
import esbuild from "esbuild";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = resolve(ROOT, "src/data/exercise-catalog.ts");

/** Import a TypeScript module from the plugin source so rules live in one place. */
async function importTs(relativePath) {
	const built = await esbuild.build({
		entryPoints: [resolve(ROOT, relativePath)],
		bundle: true,
		format: "esm",
		platform: "node",
		write: false,
	});
	const code = Buffer.from(built.outputFiles[0].text).toString("base64");
	return import(`data:text/javascript;base64,${code}`);
}

/** The dataset stores names lower-cased and with a few mojibake degree signs. */
function cleanName(raw) {
	const fixed = raw.replace(/в°/g, "°").replace(/\s+/g, " ").trim();
	return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

function intern(table, value) {
	const key = value.trim().toLowerCase();
	let index = table.indexOf(key);
	if (index === -1) index = table.push(key) - 1;
	return index;
}

const [, , datasetPath] = process.argv;
if (!datasetPath) {
	console.error("usage: node scripts/build-exercise-catalog.mjs <exercises.json>");
	process.exit(1);
}

const { deriveExerciseType } = await importTs("src/utils/exercise-type.ts");
const dataset = JSON.parse(readFileSync(resolve(datasetPath), "utf8"));

const bodyParts = [];
const equipment = [];
const muscles = [];
const seen = new Set();
const rows = [];
let skipped = 0;

for (const raw of dataset) {
	const name = cleanName(String(raw.name ?? ""));
	if (!name) continue;
	const key = name.toLowerCase();
	if (seen.has(key)) {
		skipped++;
		continue;
	}
	seen.add(key);

	const bodyPart = String(raw.body_part ?? "").trim();
	const secondary = (raw.secondary_muscles ?? [])
		.map((muscle) => String(muscle).trim())
		.filter(Boolean);

	rows.push({
		name,
		bodyPart: intern(bodyParts, bodyPart || "other"),
		equipment: intern(equipment, String(raw.equipment ?? "").trim() || "other"),
		target: intern(muscles, String(raw.target ?? "").trim() || "other"),
		secondary: secondary.map((muscle) => intern(muscles, muscle)),
		duration: deriveExerciseType(name, bodyPart) === "duration" ? 1 : 0,
	});
}

/**
 * Unicode code-point order. Not localeCompare: that follows the machine's
 * locale/ICU, so regenerating elsewhere could reorder rows.
 */
function compareCodePoints(a, b) {
	const x = Array.from(a, (ch) => ch.codePointAt(0));
	const y = Array.from(b, (ch) => ch.codePointAt(0));
	for (let i = 0; i < Math.min(x.length, y.length); i++) {
		if (x[i] !== y[i]) return x[i] - y[i];
	}
	return x.length - y.length;
}

rows.sort((a, b) => compareCodePoints(a.name, b.name));

for (const row of rows) {
	if (/[|\n\t]/.test(row.name)) throw new Error(`name breaks the row encoding: ${row.name}`);
}

const encoded = rows
	.map((r) => `${r.name}|${r.bodyPart}|${r.equipment}|${r.target}|${r.secondary.join(",")}|${r.duration}`)
	.join("\n");

const list = (values) => values.map((value) => JSON.stringify(value)).join(",\n\t");

const output = `// GENERATED FILE — do not edit by hand.
// Run: node scripts/build-exercise-catalog.mjs <exercises.json>
// Source dataset is MIT licensed; see EXERCISE-DATASET-LICENSE.md.
// ${rows.length} exercises (${skipped} duplicate names dropped).

export const CATALOG_BODY_PARTS: string[] = [
\t${list(bodyParts)},
];

export const CATALOG_EQUIPMENT: string[] = [
\t${list(equipment)},
];

export const CATALOG_MUSCLES: string[] = [
\t${list(muscles)},
];

/** One row per exercise: name|bodyPart|equipment|target|secondary,…|isDuration */
export const CATALOG_ROWS =
\t${JSON.stringify(encoded)};
`;

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, output);
console.log(
	`wrote ${OUT_FILE}: ${rows.length} exercises, ${skipped} duplicates dropped, ` +
		`${bodyParts.length} body parts, ${equipment.length} equipment, ${muscles.length} muscles, ` +
		`${(encoded.length / 1024).toFixed(1)} KiB of row data`
);
