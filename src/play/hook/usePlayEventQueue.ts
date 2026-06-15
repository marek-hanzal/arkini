import { useCallback, useRef } from "react";

/**
 * Serializes visual gameplay work that must not overlap.
 *
 * Drag drops, command commits, and their handoff animations share DOM geometry.
 * Running two of them at once means both read stale rectangles and the board
 * starts cosplaying a broken teleporter. This hook keeps those operations in a
 * small FIFO promise chain without putting queue state into React render.
 */
export function usePlayEventQueue() {
	const tailRef = useRef<Promise<unknown>>(Promise.resolve());

	return useCallback(<T>(label: string, run: () => Promise<T> | T) => {
		const job = tailRef.current.then(() => run());
		tailRef.current = job.catch((error: unknown) => {
			if (import.meta.env.DEV) {
				console.debug(`Queued play event failed: ${label}`, error);
			}
		});

		return job;
	}, []);
}
