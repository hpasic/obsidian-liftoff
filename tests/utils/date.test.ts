import { describe, expect, it, vi } from "vitest";
import { formatLocalDate } from "../../src/utils/date";

describe("formatLocalDate", () => {
	it("uses local components instead of UTC serialization", () => {
		const date = new Date(2026, 2, 21, 23, 30);
		vi.spyOn(date, "toISOString").mockReturnValue("2026-03-22T00:30:00.000Z");

		expect(formatLocalDate(date)).toBe("2026-03-21");
	});
});
