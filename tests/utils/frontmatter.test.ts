import { describe, it, expect } from "vitest";
import { workoutToFrontmatter, workoutToMarkdownBody } from "../../src/utils/frontmatter";
import type { Workout } from "../../src/types";

const sampleWorkout: Workout = {
	type: "workout",
	template: "Push Day",
	date: "2026-03-21",
	start: "14:30",
	end: "15:45",
	duration: 75,
	exercises: [
		{
			name: "Bench Press",
			sets: [
				{ weight: 80, reps: 10, unit: "kg", completed: true },
				{ weight: 90, reps: 8, unit: "kg", completed: true },
			],
		},
	],
};

describe("workoutToFrontmatter", () => {
	it("serializes workout to YAML frontmatter string", () => {
		const result = workoutToFrontmatter(sampleWorkout);
		expect(result).toContain("type: workout");
		expect(result).toContain("template: Push Day");
		expect(result).toContain('date: "2026-03-21"');
		expect(result).toContain("name: Bench Press");
		expect(result).toContain("weight: 80");
		expect(result).toContain("reps: 10");
		expect(result).toContain("unit: kg");
		expect(result.startsWith("---\n")).toBe(true);
		expect(result.endsWith("\n---")).toBe(true);
	});
});

describe("workoutToMarkdownBody", () => {
	it("generates readable markdown tables", () => {
		const result = workoutToMarkdownBody(sampleWorkout);
		expect(result).toContain("# Push Day");
		expect(result).toContain("## Bench Press");
		expect(result).toContain("| 1   | 80 kg  | 10   |");
		expect(result).toContain("| 2   | 90 kg  | 8    |");
		expect(result).toContain("| Set | Weight | Reps |");
	});

	it("uses Workout as title for freeform workouts", () => {
		const freeform = { ...sampleWorkout, template: null };
		const result = workoutToMarkdownBody(freeform);
		expect(result).toContain("# Workout");
	});
});

const timerWorkout: Workout = {
	type: "workout",
	template: "HIIT",
	date: "2026-03-21",
	start: "07:00",
	end: "07:30",
	duration: 30,
	exercises: [
		{
			name: "Burpees",
			exerciseType: "timer",
			sets: [],
			workSeconds: 40,
			restSeconds: 20,
			intervals: 5,
		},
	],
};

describe("timer exercise frontmatter", () => {
	it("serializes timer exercise with exercise-level params", () => {
		const result = workoutToFrontmatter(timerWorkout);
		expect(result).toContain("exerciseType: timer");
		expect(result).toContain("workSeconds: 40");
		expect(result).toContain("restSeconds: 20");
		expect(result).toContain("intervals: 5");
		expect(result).not.toContain("weight:");
		expect(result).not.toContain("sets:");
	});

	it("omits transitionSeconds when absent or zero", () => {
		expect(workoutToFrontmatter(timerWorkout)).not.toContain("transitionSeconds");

		const zeroed: Workout = {
			...timerWorkout,
			exercises: [{ ...timerWorkout.exercises[0]!, transitionSeconds: 0 }],
		};
		expect(workoutToFrontmatter(zeroed)).not.toContain("transitionSeconds");
	});

	it("emits transitionSeconds when set", () => {
		const w: Workout = {
			...timerWorkout,
			exercises: [{ ...timerWorkout.exercises[0]!, transitionSeconds: 5 }],
		};
		const result = workoutToFrontmatter(w);
		expect(result).toContain("restSeconds: 20");
		expect(result).toContain("transitionSeconds: 5");
		expect(result).toContain("intervals: 5");
	});
});

describe("timer exercise markdown body", () => {
	it("renders interval summary for timer exercises", () => {
		const result = workoutToMarkdownBody(timerWorkout);
		expect(result).toContain("## Burpees");
		expect(result).toContain("5");
		expect(result).toContain("0:40");
		expect(result).toContain("0:20");
		expect(result).not.toContain("Weight");
	});
});

describe("duration exercise serialization", () => {
	const durationWorkout: Workout = {
		type: "workout",
		template: null,
		date: "2026-05-25",
		start: "10:00",
		end: "10:20",
		duration: 20,
		exercises: [
			{
				name: "Plank",
				exerciseType: "duration",
				sets: [
					{ weight: 0, reps: 0, unit: "kg", completed: true, durationSeconds: 60 },
					{ weight: 0, reps: 0, unit: "kg", completed: true, durationSeconds: 75 },
				],
			},
		],
	};

	it("emits exerciseType: duration and durationSeconds per set in frontmatter", () => {
		const result = workoutToFrontmatter(durationWorkout);
		expect(result).toContain("exerciseType: duration");
		expect(result).toContain("durationSeconds: 60");
		expect(result).toContain("durationSeconds: 75");
		expect(result).not.toContain("weight: 0");
	});

	it("renders Set | Time table in markdown body", () => {
		const result = workoutToMarkdownBody(durationWorkout);
		expect(result).toContain("## Plank");
		expect(result).toContain("| Set | Time |");
		expect(result).toContain("1:00");
		expect(result).toContain("1:15");
		expect(result).not.toContain("Weight");
	});
});

describe("exercise note serialization", () => {
	it("omits the note line when there is no note", () => {
		const result = workoutToFrontmatter(sampleWorkout);
		expect(result).not.toContain("note:");
	});

	it("emits a quoted note in frontmatter and a blockquote in the body", () => {
		const w: Workout = {
			...sampleWorkout,
			exercises: [{ ...sampleWorkout.exercises[0]!, note: "felt strong\ngrip slipping" }],
		};
		const fm = workoutToFrontmatter(w);
		expect(fm).toContain('note: "felt strong\\ngrip slipping"');

		const body = workoutToMarkdownBody(w);
		expect(body).toContain("> felt strong");
		expect(body).toContain("> grip slipping");
	});

	it("escapes embedded double quotes in the frontmatter note", () => {
		const w: Workout = {
			...sampleWorkout,
			exercises: [{ ...sampleWorkout.exercises[0]!, note: 'use the "wide" grip' }],
		};
		expect(workoutToFrontmatter(w)).toContain('note: "use the \\"wide\\" grip"');
	});
});

describe("setType serialization", () => {
	it("omits setType for working sets (default)", () => {
		const result = workoutToFrontmatter(sampleWorkout);
		expect(result).not.toContain("setType");
	});

	it("emits non-working setType in frontmatter", () => {
		const w: Workout = {
			...sampleWorkout,
			exercises: [
				{
					name: "Squat",
					sets: [
						{ weight: 60, reps: 10, unit: "kg", completed: true, setType: "warmup" },
						{ weight: 100, reps: 5, unit: "kg", completed: true, setType: "failure" },
					],
				},
			],
		};
		const result = workoutToFrontmatter(w);
		expect(result).toContain("setType: warmup");
		expect(result).toContain("setType: failure");
	});

	it("annotates non-working set types in the body table", () => {
		const w: Workout = {
			...sampleWorkout,
			exercises: [
				{
					name: "Squat",
					sets: [
						{ weight: 60, reps: 10, unit: "kg", completed: true, setType: "warmup" },
						{ weight: 100, reps: 5, unit: "kg", completed: true },
						{ weight: 80, reps: 8, unit: "kg", completed: true, setType: "drop" },
					],
				},
			],
		};
		const result = workoutToMarkdownBody(w);
		expect(result).toContain("1 (W)");
		expect(result).toContain("3 (drop)");
	});
});
