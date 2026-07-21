import type { CheatAvailability } from "~/bridge/cheat/CheatAvailability";

/** Creates the one renderer-wide live snapshot of application cheat-tool availability. */
export const createCheatAvailability = (): CheatAvailability => {
	const listeners = new Set<() => void | PromiseLike<void>>();
	let available = false;
	let ready = false;
	let resolveReady!: () => void;
	const readyPromise = new Promise<void>((resolve) => {
		resolveReady = resolve;
	});
	return {
		getSnapshot: () => available,
		apply: (nextAvailable) => {
			const changed = available !== nextAvailable;
			available = nextAvailable;
			if (!ready) {
				ready = true;
				resolveReady();
			}
			if (!changed) return;
			for (const listener of Array.from(listeners)) {
				try {
					const result = listener();
					if (result !== undefined) void Promise.resolve(result).catch(() => undefined);
				} catch {
					// Preference observers are presentation only and cannot block persistence.
				}
			}
		},
		waitUntilReady: () => readyPromise,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
};
