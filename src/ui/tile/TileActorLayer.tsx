import { useContext, useRef } from "react";

import { useTileActors } from "~/bridge/tile/useTileActors";
import { TileActor } from "~/ui/tile/TileActor";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import { TileSystemContext } from "~/ui/tile/TileSystemContext";

export namespace TileActorLayer {
	export interface Props {
		readonly readActive: () => TileInteractionState | null;
	}
}

const protectedActorIds = (active: TileInteractionState | null) => {
	const ids = new Set<string>();
	if (active === null) return ids;

	ids.add(active.source.id);
	if (active.target?.kind === "slot" && active.target.occupant !== null) {
		ids.add(active.target.occupant.id);
	}
	if (active.phase !== "settling") return ids;

	if (active.outcome?.kind === "merge") {
		if (active.mergeStage === "approach") {
			ids.add(active.outcome.source.itemId);
			ids.add(active.outcome.target.itemId);
			return ids;
		}
		if (active.mergeStage === "resolve") {
			return new Set(active.pendingActorIds);
		}
	}
	for (const itemId of active.pendingActorIds) ids.add(itemId);
	return ids;
};

/** Renders one stable Motion actor per live or actively exiting grid-item identity. */
export const TileActorLayer = ({ readActive }: TileActorLayer.Props) => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	const liveItems = useTileActors();
	const actorSnapshots = useRef(new Map<string, useTileActors.Item>());
	const protectedIds = protectedActorIds(readActive());
	const liveIds = new Set<string>();

	for (const item of liveItems) {
		liveIds.add(item.id);
		actorSnapshots.current.set(item.id, item);
	}
	for (const itemId of actorSnapshots.current.keys()) {
		if (!liveIds.has(itemId) && !protectedIds.has(itemId)) {
			actorSnapshots.current.delete(itemId);
		}
	}

	return (
		<div
			ref={system.registerActorLayer}
			className="pointer-events-none absolute inset-0 z-10 overflow-visible"
			data-ui="TileActorLayer"
		>
			{Array.from(actorSnapshots.current.values()).map((item) => (
				<TileActor
					key={item.id}
					item={item}
				/>
			))}
		</div>
	);
};
