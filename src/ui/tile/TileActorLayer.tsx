import { useContext } from "react";

import { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActor } from "~/ui/tile/TileActor";
import { TileSystemContext } from "~/ui/tile/TileSystemContext";

/** Renders one stable Motion actor per live grid item above all registered slot surfaces. */
export const TileActorLayer = () => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	const items = useTileActors();

	return (
		<div
			ref={system.registerActorLayer}
			className="pointer-events-none absolute inset-0 z-10 overflow-visible"
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
