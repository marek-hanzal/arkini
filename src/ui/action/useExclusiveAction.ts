import { useMemo, useState, useSyncExternalStore } from "react";

export interface ExclusiveActionOwner<Action extends string> {
	readonly claim: (action: Action) => boolean;
	readonly getSnapshot: () => Action | null;
	readonly release: (action: Action) => void;
	readonly subscribe: (listener: () => void) => () => void;
}

/** Creates one synchronous owner that admits at most one action at a time. */
export const createExclusiveActionOwner = <
	Action extends string,
>(): ExclusiveActionOwner<Action> => {
	const listeners = new Set<() => void>();
	let active: Action | null = null;

	const publish = (next: Action | null) => {
		if (active === next) return;
		active = next;
		for (const listener of Array.from(listeners)) listener();
	};

	return {
		claim: (action) => {
			if (active !== null) return false;
			publish(action);
			return true;
		},
		getSnapshot: () => active,
		release: (action) => {
			if (active === action) publish(null);
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
};

/** Owns one synchronous UI action claim and exposes it as one React snapshot. */
export const useExclusiveAction = <Action extends string>() => {
	const [owner] = useState(() => createExclusiveActionOwner<Action>());
	const active = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);

	return useMemo(
		() => ({
			active,
			claim: owner.claim,
			getSnapshot: owner.getSnapshot,
			release: owner.release,
		}),
		[
			active,
			owner,
		],
	);
};
