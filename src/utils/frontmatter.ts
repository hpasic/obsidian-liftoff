import type { Workout } from "../types";
import { effectiveSetType } from "./sets";

const SET_TYPE_BODY_LABEL: Record<string, string> = {
	working: "",
	warmup: " (W)",
	drop: " (drop)",
	failure: " (failure)",
};

/** Wrap free text as a YAML double-quoted scalar, escaping it so newlines survive a round-trip. */
function yamlQuote(value: string): string {
	const escaped = value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n");
	return `"${escaped}"`;
}

export function workoutToFrontmatter(workout: Workout): string {
	const lines: string[] = ["---"];

	lines.push(`type: ${workout.type}`);
	if (workout.template) {
		lines.push(`template: ${workout.template}`);
	}
	lines.push(`date: "${workout.date}"`);
	lines.push(`start: "${workout.start}"`);
	if (workout.end) {
		lines.push(`end: "${workout.end}"`);
	}
	if (workout.duration !== null) {
		lines.push(`duration: ${workout.duration}`);
	}

	lines.push("exercises:");
	for (const exercise of workout.exercises) {
		lines.push(`  - name: ${exercise.name}`);
		if (exercise.note && exercise.note.trim()) {
			lines.push(`    note: ${yamlQuote(exercise.note.trim())}`);
		}
		if (exercise.exerciseType === "timer") {
			lines.push(`    exerciseType: timer`);
			lines.push(`    workSeconds: ${exercise.workSeconds ?? 0}`);
			lines.push(`    restSeconds: ${exercise.restSeconds ?? 0}`);
			if ((exercise.transitionSeconds ?? 0) > 0) {
				lines.push(`    transitionSeconds: ${exercise.transitionSeconds}`);
			}
			lines.push(`    intervals: ${exercise.intervals ?? 0}`);
		} else if (exercise.exerciseType === "duration") {
			lines.push(`    exerciseType: duration`);
			lines.push("    sets:");
			for (const set of exercise.sets) {
				const parts = [`durationSeconds: ${set.durationSeconds ?? 0}`];
				if (set.setType && set.setType !== "working") {
					parts.push(`setType: ${set.setType}`);
				}
				lines.push(`      - { ${parts.join(", ")} }`);
			}
		} else {
			lines.push("    sets:");
			for (const set of exercise.sets) {
				const parts = [
					`weight: ${set.weight}`,
					`reps: ${set.reps}`,
					`unit: ${set.unit}`,
				];
				if (set.setType && set.setType !== "working") {
					parts.push(`setType: ${set.setType}`);
				}
				lines.push(`      - { ${parts.join(", ")} }`);
			}
		}
	}

	lines.push("---");
	return lines.join("\n");
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

export function workoutToMarkdownBody(workout: Workout): string {
	const title = workout.template ?? "Workout";
	const dateParts = workout.date.split("-");
	const dateObj = new Date(
		parseInt(dateParts[0]!),
		parseInt(dateParts[1]!) - 1,
		parseInt(dateParts[2]!)
	);
	const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const formattedDate = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

	const lines: string[] = [`# ${title} — ${formattedDate}`, ""];

	for (const exercise of workout.exercises) {
		lines.push(`## ${exercise.name}`);
		if (exercise.note && exercise.note.trim()) {
			for (const noteLine of exercise.note.trim().split("\n")) {
				lines.push(`> ${noteLine}`);
			}
			// Blank line so the table below isn't lazily absorbed into the blockquote
			lines.push("");
		}
		if (exercise.exerciseType === "timer") {
			const w = formatTime(exercise.workSeconds ?? 0);
			const r = formatTime(exercise.restSeconds ?? 0);
			const t = exercise.transitionSeconds ?? 0;
			const n = exercise.intervals ?? 0;
			const switchPart = t > 0 ? ` / ${formatTime(t)} switch` : "";
			lines.push(`Intervals: ${n} \u00D7 ${w} work / ${r} rest${switchPart}`);
		} else if (exercise.exerciseType === "duration") {
			lines.push("| Set | Time |");
			lines.push("|-----|------|");
			exercise.sets.forEach((set, i) => {
				const typeSuffix = SET_TYPE_BODY_LABEL[effectiveSetType(set)] ?? "";
				const setLabel = `${i + 1}${typeSuffix}`;
				lines.push(
					`| ${setLabel.padEnd(3)} | ${formatTime(set.durationSeconds ?? 0).padEnd(4)} |`
				);
			});
		} else {
			lines.push("| Set | Weight | Reps |");
			lines.push("|-----|--------|------|");
			exercise.sets.forEach((set, i) => {
				const weightStr = `${set.weight} ${set.unit}`;
				const typeSuffix = SET_TYPE_BODY_LABEL[effectiveSetType(set)] ?? "";
				const setLabel = `${i + 1}${typeSuffix}`;
				lines.push(
					`| ${setLabel.padEnd(3)} | ${weightStr.padEnd(6)} | ${String(set.reps).padEnd(4)} |`
				);
			});
		}
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}

export function workoutToFullMarkdown(workout: Workout, extraSections: string = ""): string {
	const tail = extraSections ? "\n\n" + extraSections : "";
	return workoutToFrontmatter(workout) + "\n" + workoutToMarkdownBody(workout) + tail + "\n";
}
