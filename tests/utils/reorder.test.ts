import { describe, it, expect } from "vitest";
import { remapIndexAfterSwap, remapIndexAfterRemoval } from "../../src/utils/reorder";

describe("remapIndexAfterSwap", () => {
	it("follows the item that moved down", () => {
		expect(remapIndexAfterSwap(1, 1, 2)).toBe(2);
	});

	it("follows the item that moved up", () => {
		expect(remapIndexAfterSwap(2, 2, 1)).toBe(1);
	});

	it("follows the displaced item", () => {
		expect(remapIndexAfterSwap(2, 1, 2)).toBe(1);
	});

	it("leaves untouched indices alone", () => {
		expect(remapIndexAfterSwap(4, 1, 2)).toBe(4);
		expect(remapIndexAfterSwap(0, 1, 2)).toBe(0);
	});

	it("passes null through", () => {
		expect(remapIndexAfterSwap(null, 0, 1)).toBeNull();
	});
});

describe("remapIndexAfterRemoval", () => {
	it("shifts down indices after the removal", () => {
		expect(remapIndexAfterRemoval(3, 1)).toBe(2);
	});

	it("leaves indices before the removal alone", () => {
		expect(remapIndexAfterRemoval(0, 1)).toBe(0);
	});

	it("returns null when the tracked item was removed", () => {
		expect(remapIndexAfterRemoval(2, 2)).toBeNull();
	});

	it("passes null through", () => {
		expect(remapIndexAfterRemoval(null, 0)).toBeNull();
	});
});
