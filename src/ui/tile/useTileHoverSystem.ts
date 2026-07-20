import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useTileSystemContext } from "~/ui/tile/useTileSystemContext";

/** Exposes one actor-scoped snapshot of the Canvas-local hover action owner. */
export const useTileHoverSystem = (itemId: string) => {
	const { claimHover, releaseHover, isHoverOwner, subscribeHover } = useTileSystemContext();
	const subscribe = useCallback(
		(listener: () => void) => subscribeHover(itemId, listener),
		[
			itemId,
			subscribeHover,
		],
	);
	const getSnapshot = useCallback(
		() => isHoverOwner(itemId),
		[
			isHoverOwner,
			itemId,
		],
	);
	const open = useSyncExternalStore(subscribe, getSnapshot, () => false);
	const claim = useCallback(
		() => claimHover(itemId),
		[
			claimHover,
			itemId,
		],
	);
	const release = useCallback(
		() => releaseHover(itemId),
		[
			itemId,
			releaseHover,
		],
	);

	useEffect(
		() => release,
		[
			release,
		],
	);

	return {
		open,
		claimHover: claim,
		releaseHover: release,
	};
};
