import { memo } from "react";

import { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActor } from "~/ui/tile/TileActor";
import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

/** Renders the current runtime actor snapshot without retaining animation-only identities. */
const TileActorLayerComponent = () => {
	const items = useTileActors();
	const { registerActorLayer } = useTileSystemApiContext();

	return (
		<div
			ref={registerActorLayer}
			className="pointer-events-none absolute inset-0 overflow-visible"
			data-ui="TileActorLayer"
		>
			{items.map((item) => (
				<TileActor
					key={item.id}
					item={item}
				/>
			))}
		</div>
	);
};

export const TileActorLayer = memo(TileActorLayerComponent);
