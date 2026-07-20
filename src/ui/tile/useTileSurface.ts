import { useCallback } from "react";

import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSurfaceSystem } from "~/ui/tile/useTileSurfaceSystem";

/** Registers one concrete tile surface with the Canvas-local geometry owner. */
export const useTileSurface = (surface: TileSurface) => {
	const { registerSurface } = useTileSurfaceSystem();
	return useCallback(
		(node: HTMLElement | null) => registerSurface(surface, node),
		[
			registerSurface,
			surface,
		],
	);
};
