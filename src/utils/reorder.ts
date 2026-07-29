/** Where a tracked index lands after the items at `from` and `to` swap places. */
export function remapIndexAfterSwap(
	tracked: number | null,
	from: number,
	to: number
): number | null {
	if (tracked === null) return null;
	if (tracked === from) return to;
	if (tracked === to) return from;
	return tracked;
}

/**
 * Where a tracked index lands after the item at `removed` is spliced out.
 * Returns null when the tracked item itself was removed.
 */
export function remapIndexAfterRemoval(tracked: number | null, removed: number): number | null {
	if (tracked === null || tracked === removed) return null;
	return tracked > removed ? tracked - 1 : tracked;
}
