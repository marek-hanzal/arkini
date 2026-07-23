import { type PropsWithChildren, useCallback, useMemo } from "react";

import { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import { useDropItemPreviewSequence } from "~/bridge/tile/useDropItemPreviewSequence";
import { TileActorLayer } from "~/ui/tile/TileActorLayer";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import {
	TileInteractionContext,
	type TileInteractionSubscription,
} from "~/ui/tile/TileInteractionContext";
import { TileSystemApiContext, type TileSystemApi } from "~/ui/tile/TileSystemApiContext";
import { useTileGeometry } from "~/ui/tile/useTileGeometry";
import { useTileInteractionController } from "~/ui/tile/useTileInteractionController";
import { useTileNeighbourField } from "~/ui/tile/useTileNeighbourField";
import { tileLocationForTarget } from "~/ui/tile/tileLocationForTarget";

/** Composes the focused Canvas-local geometry and interaction owners. */
export const TileSystemProvider = ({ children }: PropsWithChildren) => {
	const geometry = useTileGeometry();
	const dropItemPreview = useDropItemPreview();
	const readPreviewSequence = useDropItemPreviewSequence();
	const readPreview = useCallback(
		(source: TileDragSource, target: TileDropTarget) => {
			const location = tileLocationForTarget(target);
			return dropItemPreview({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				sourceLocation: source.location,
				target:
					location === null || target.kind !== "slot"
						? {
								kind: "unsupported",
							}
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
		[
			dropItemPreview,
		],
	);
	const interaction = useTileInteractionController({
		readPreview,
		resolveTarget: geometry.resolveTarget,
	});
	const neighbourField = useTileNeighbourField({
		readPreview,
		readPreviewSequence,
		refreshActivePreview: interaction.refreshActivePreview,
	});
	const api = useMemo<TileSystemApi>(
		() => ({
			geometryVersion: geometry.geometryVersion,
			registerActorLayer: geometry.registerActorLayer,
			registerSurface: geometry.registerSurface,
			registerSlot: geometry.registerSlot,
			readActorLayerRect: geometry.readActorLayerRect,
			readPlacement: geometry.readPlacement,
			press: interaction.press,
			startDrag: interaction.startDrag,
			moveDrag: interaction.moveDrag,
			refreshActivePreview: interaction.refreshActivePreview,
			refreshSlotTarget: interaction.refreshSlotTarget,
			release: interaction.release,
			settle: interaction.settle,
			complete: interaction.complete,
			cancel: interaction.cancel,
			resetInteraction: interaction.resetInteraction,
			readActorRect: neighbourField.readActorRect,
			readActorSource: neighbourField.readActorSource,
			followActorPose: neighbourField.followActorPose,
			registerNeighbourActor: neighbourField.registerNeighbourActor,
			updateNeighbourActor: neighbourField.updateNeighbourActor,
			beginNeighbourTravel: neighbourField.beginNeighbourTravel,
			setNeighbourTravelTarget: neighbourField.setNeighbourTravelTarget,
			setNeighbourSemanticSource: neighbourField.setNeighbourSemanticSource,
			refreshNeighbourField: neighbourField.refreshNeighbourField,
			clearNeighbourField: neighbourField.clearNeighbourField,
		}),
		[
			geometry.geometryVersion,
			geometry.readActorLayerRect,
			geometry.readPlacement,
			geometry.registerActorLayer,
			geometry.registerSlot,
			geometry.registerSurface,
			interaction.cancel,
			interaction.complete,
			interaction.moveDrag,
			interaction.press,
			interaction.refreshActivePreview,
			interaction.refreshSlotTarget,
			interaction.release,
			interaction.resetInteraction,
			interaction.settle,
			interaction.startDrag,
			neighbourField.beginNeighbourTravel,
			neighbourField.clearNeighbourField,
			neighbourField.followActorPose,
			neighbourField.readActorRect,
			neighbourField.readActorSource,
			neighbourField.refreshNeighbourField,
			neighbourField.registerNeighbourActor,
			neighbourField.setNeighbourSemanticSource,
			neighbourField.setNeighbourTravelTarget,
			neighbourField.updateNeighbourActor,
		],
	);
	const selection = useMemo<TileInteractionSubscription>(
		() => ({
			readActive: interaction.readActive,
			subscribeActive: interaction.subscribeActive,
		}),
		[
			interaction.readActive,
			interaction.subscribeActive,
		],
	);
	return (
		<TileSystemApiContext.Provider value={api}>
			<TileInteractionContext.Provider value={selection}>
				{children}
				<TileActorLayer />
			</TileInteractionContext.Provider>
		</TileSystemApiContext.Provider>
	);
};
