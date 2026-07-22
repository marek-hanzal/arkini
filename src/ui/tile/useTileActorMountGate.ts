import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";

/** Delays uncued first mounts by one frame so committed spawn cues own the first painted pose. */
export const useTileActorMountGate = ({
	liveItems,
	cues,
}: {
	readonly liveItems: ReadonlyArray<useTileActors.Item>;
	readonly cues: ReadonlyMap<string, TileMotionCueSchema.Type>;
}) => {
	const game = useGameEngine();
	const gameRef = useRef(game);
	const liveIdsRef = useRef(new Set(liveItems.map((item) => item.id)));
	const [releasedIds, setReleasedIds] = useState<ReadonlySet<string>>(() => new Set());

	useLayoutEffect(() => {
		liveIdsRef.current = new Set(liveItems.map((item) => item.id));
	}, [
		liveItems,
	]);

	useEffect(() => {
		if (gameRef.current === game) return;
		gameRef.current = game;
		setReleasedIds(new Set());
	}, [
		game,
	]);

	useEffect(() => {
		const pendingIds = liveItems
			.map((item) => item.id)
			.filter((itemId) => !releasedIds.has(itemId) && !cues.has(itemId));
		if (pendingIds.length === 0) return;
		const frame = requestAnimationFrame(() => {
			setReleasedIds((current) => {
				const next = new Set(current);
				for (const itemId of pendingIds) {
					if (liveIdsRef.current.has(itemId)) next.add(itemId);
				}
				return next.size === current.size ? current : next;
			});
		});
		return () => cancelAnimationFrame(frame);
	}, [
		cues,
		liveItems,
		releasedIds,
	]);

	return useMemo(
		() => liveItems.filter((item) => releasedIds.has(item.id) || cues.has(item.id)),
		[
			cues,
			liveItems,
			releasedIds,
		],
	);
};
