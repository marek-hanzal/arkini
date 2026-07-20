import { type PropsWithChildren, useMemo } from "react";

import { TileActorLayer } from "~/ui/tile/TileActorLayer";
import { TileSystemContext, type TileSystem } from "~/ui/tile/TileSystemContext";
import { useTileGeometry } from "~/ui/tile/useTileGeometry";
import { useTileInteractionController } from "~/ui/tile/useTileInteractionController";

/** Composes the focused Canvas-local geometry and interaction owners. */
export const TileSystemProvider = ({ children }: PropsWithChildren) => {
	const geometry = useTileGeometry();
	const interaction = useTileInteractionController({
		resolveTarget: geometry.resolveTarget,
	});
	const value = useMemo<TileSystem>(
		() => ({
			geometryVersion: geometry.geometryVersion,
			registerActorLayer: geometry.registerActorLayer,
			registerSurface: geometry.registerSurface,
			registerSlot: geometry.registerSlot,
			readPlacement: geometry.readPlacement,
			...interaction,
		}),
		[
			geometry.geometryVersion,
			geometry.readPlacement,
			geometry.registerActorLayer,
			geometry.registerSlot,
			geometry.registerSurface,
			interaction,
		],
	);

	return (
		<TileSystemContext.Provider value={value}>
			{children}
			<TileActorLayer />
		</TileSystemContext.Provider>
	);
};
