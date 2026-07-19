import { useCallback, useContext } from "react";

import type { TileSurface } from "~/ui/tile/TileSurface";
import { TileSystemContext } from "~/ui/tile/TileSystemContext";

/** Registers one top-level Board, inventory, or toolbar drop surface. */
export const useTileSurface = (surface: TileSurface) => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	const { registerSurface } = system;

	return useCallback(
		(node: HTMLElement | null) => registerSurface(surface, node),
		[
			registerSurface,
			surface,
		],
	);
};
