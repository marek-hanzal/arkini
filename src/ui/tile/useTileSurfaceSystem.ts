import { useTileSystemContext } from "~/ui/tile/useTileSystemContext";

/** Exposes only Canvas surface registration. */
export const useTileSurfaceSystem = () => {
	const { registerSurface } = useTileSystemContext();
	return {
		registerSurface,
	};
};
