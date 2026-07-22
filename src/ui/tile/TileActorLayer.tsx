import { useMemo } from "react";

import { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActor } from "~/ui/tile/TileActor";
import { TileActorRetentionContext } from "~/ui/tile/TileActorRetentionContext";
import { useRetainedTileActors } from "~/ui/tile/useRetainedTileActors";
import { useTileActorLayerSystem } from "~/ui/tile/useTileActorLayerSystem";
import { useTileActorMountGate } from "~/ui/tile/useTileActorMountGate";
import { useTileMotionCues } from "~/ui/tile/useTileMotionCues";

/** Renders one stable Motion actor per live or explicitly retained presentation identity. */
export const TileActorLayer = () => {
	const { active, registerActorLayer } = useTileActorLayerSystem();
	const liveItems = useTileActors();
	const retention = useRetainedTileActors({
		active,
		liveItems,
	});
	const motionCues = useTileMotionCues(liveItems);
	const mountedLiveItems = useTileActorMountGate({
		liveItems,
		cues: motionCues.cues,
	});
	const actors = useMemo(() => {
		const byId = new Map<
			string,
			{
				readonly item: (typeof liveItems)[number];
				readonly live: boolean;
			}
		>();
		for (const item of motionCues.retainedItems) byId.set(item.id, { item, live: false });
		for (const item of retention.retainedItems) byId.set(item.id, { item, live: false });
		for (const item of mountedLiveItems) byId.set(item.id, { item, live: true });
		return [...byId.values()];
	}, [
		motionCues.retainedItems,
		mountedLiveItems,
		retention.retainedItems,
	]);

	return (
		<div
			ref={registerActorLayer}
			className="pointer-events-none absolute inset-0 z-10 overflow-visible"
			data-ui="TileActorLayer"
		>
			<TileActorRetentionContext.Provider value={retention.retainActorIds}>
				{actors.map(({ item, live }) => (
					<TileActor
						key={item.id}
						item={item}
						live={live}
						cue={motionCues.cues.get(item.id) ?? null}
						onCueComplete={motionCues.complete}
					/>
				))}
			</TileActorRetentionContext.Provider>
		</div>
	);
};
