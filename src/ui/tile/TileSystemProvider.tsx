import { type PropsWithChildren, useCallback, useLayoutEffect, useMemo } from "react";

import { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
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
import { tileLocationForTarget } from "~/ui/tile/tileLocationForTarget";

export namespace TileSystemProvider {
	export interface Props extends PropsWithChildren {
		readonly interactionBlocked?: boolean;
	}
}

/** Composes the focused Canvas-local geometry and interaction owners. */
export const TileSystemProvider = ({
	children,
	interactionBlocked = false,
}: TileSystemProvider.Props) => {
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
	useLayoutEffect(() => {
		if (interactionBlocked) interaction.resetInteraction();
	}, [
		interaction.resetInteraction,
		interactionBlocked,
	]);
	const press = useCallback(
		(source: TileDragSource) => !interactionBlocked && interaction.press(source),
		[
			interaction.press,
			interactionBlocked,
		],
	);
	const registerSurface = useCallback(
		(
			surface: Parameters<typeof geometry.registerSurface>[0],
			node: Parameters<typeof geometry.registerSurface>[1],
		) => {
			const unregistered = geometry.registerSurface(surface, node);
			const active = interaction.readActive();
			if (
				!unregistered ||
				active === null ||
				(active.phase !== "pressed" && active.phase !== "dragging")
			) {
				return unregistered;
			}
			interaction.resetInteraction();
			return unregistered;
		},
		[
			geometry.registerSurface,
			interaction.readActive,
			interaction.resetInteraction,
		],
	);
	const api = useMemo<TileSystemApi>(
		() => ({
			geometryVersion: geometry.geometryVersion,
			interactionBlocked,
			registerActorLayer: geometry.registerActorLayer,
			registerSurface,
			registerSlot: geometry.registerSlot,
			readPlacement: geometry.readPlacement,
			press,
			startDrag: interaction.startDrag,
			moveDrag: interaction.moveDrag,
			refreshSlotTarget: interaction.refreshSlotTarget,
			release: interaction.release,
			completeDrop: interaction.completeDrop,
			cancel: interaction.cancel,
			resetInteraction: interaction.resetInteraction,
		}),
		[
			geometry.geometryVersion,
			geometry.readPlacement,
			geometry.registerActorLayer,
			geometry.registerSlot,
			interactionBlocked,
			interaction.cancel,
			interaction.moveDrag,
			interaction.refreshSlotTarget,
			interaction.release,
			interaction.resetInteraction,
			interaction.completeDrop,
			interaction.startDrag,
			press,
			registerSurface,
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
