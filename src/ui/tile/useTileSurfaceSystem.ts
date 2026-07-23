import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

/** Exposes only Canvas surface registration. */
export const useTileSurfaceSystem = () => {
	const { registerSurface } = useTileSystemApiContext();
	return {
		registerSurface,
	};
};
