import { useMemo, useRef } from "react";

/** Owns the one Canvas-local live actor whose hover actions may remain open. */
export const useTileHoverController = () => {
	const hoveredActorId = useRef<string | null>(null);
	const listeners = useRef(new Map<string, Set<() => void>>());

	return useMemo(() => {
		const notify = (itemId: string) => {
			for (const listener of listeners.current.get(itemId) ?? []) listener();
		};

		return {
			claimHover: (itemId: string) => {
				if (hoveredActorId.current === itemId) return;
				const previous = hoveredActorId.current;
				hoveredActorId.current = itemId;
				if (previous !== null) notify(previous);
				notify(itemId);
			},
			releaseHover: (itemId: string) => {
				if (hoveredActorId.current !== itemId) return;
				hoveredActorId.current = null;
				notify(itemId);
			},
			isHoverOwner: (itemId: string) => hoveredActorId.current === itemId,
			subscribeHover: (itemId: string, listener: () => void) => {
				const itemListeners = listeners.current.get(itemId) ?? new Set<() => void>();
				itemListeners.add(listener);
				listeners.current.set(itemId, itemListeners);
				return () => {
					itemListeners.delete(listener);
					if (itemListeners.size === 0) listeners.current.delete(itemId);
				};
			},
		};
	}, []);
};
