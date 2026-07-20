import { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActor } from "~/ui/tile/TileActor";
import { TileActorRetentionContext } from "~/ui/tile/TileActorRetentionContext";
import { useRetainedTileActors } from "~/ui/tile/useRetainedTileActors";
import { useTileActorLayerSystem } from "~/ui/tile/useTileActorLayerSystem";

/** Renders one stable Motion actor per live or explicitly retained presentation identity. */
export const TileActorLayer = () => {
	const { active, registerActorLayer } = useTileActorLayerSystem();
	const liveItems = useTileActors();
	const retention = useRetainedTileActors({
		active,
		liveItems,
	});

	const actors = [
		...liveItems.map(
			(item) =>
				({
					item,
					live: true,
				}) as const,
		),
		...retention.retainedItems.map(
			(item) =>
				({
					item,
					live: false,
				}) as const,
		),
	];

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
					/>
				))}
			</TileActorRetentionContext.Provider>
		</div>
	);
};
