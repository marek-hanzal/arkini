import { type PropsWithChildren, useCallback, useMemo } from "react";

import { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import { TileActorLayer } from "~/ui/tile/TileActorLayer";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import { TileSystemContext, type TileSystem } from "~/ui/tile/TileSystemContext";
import { useTileGeometry } from "~/ui/tile/useTileGeometry";
import { useTileInteractionController } from "~/ui/tile/useTileInteractionController";
import { useTileNeighbourField } from "~/ui/tile/useTileNeighbourField";
import { tileLocationForTarget } from "~/ui/tile/tileLocationForTarget";

/** Composes the focused Canvas-local geometry and interaction owners. */
export const TileSystemProvider = ({ children }: PropsWithChildren) => {
	const geometry = useTileGeometry();
	const dropItemPreview = useDropItemPreview();
	const readPreview = useCallback(
		(source: TileDragSource, target: TileDropTarget) => {
			const location = tileLocationForTarget(target);
			return dropItemPreview({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				sourceLocation: source.location,
				target:
					location === null || target.kind !== "slot"
						? { kind: "unsupported" }
						: {
							kind: "slot",
							location,
							occupant:
								target.occupant === null
									? null
									: {
										itemId: target.occupant.id,
										revision: target.occupant.revision,
									},
							},
			});
		},
		[dropItemPreview],
	);
	const interaction = useTileInteractionController({
		readPreview,
		resolveTarget: geometry.resolveTarget,
	});
	const neighbourField = useTileNeighbourField();
	const value = useMemo<TileSystem>(
		() => ({
			geometryVersion: geometry.geometryVersion,
			registerActorLayer: geometry.registerActorLayer,
			registerSurface: geometry.registerSurface,
			registerSlot: geometry.registerSlot,
			readActorLayerRect: geometry.readActorLayerRect,
			readPlacement: geometry.readPlacement,
			...interaction,
			...neighbourField,
		}),
		[
			geometry.geometryVersion,
			geometry.readActorLayerRect,
			geometry.readPlacement,
			geometry.registerActorLayer,
			geometry.registerSlot,
			geometry.registerSurface,
			interaction,
			neighbourField,
		],
	);

	return (
		<TileSystemContext.Provider value={value}>
			{children}
			<TileActorLayer />
		</TileSystemContext.Provider>
	);
};
