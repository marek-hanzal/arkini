import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

/** Exposes only actor-owned interaction commands and placement measurement. */
export const useTileActorSystem = () => {
	const {
		geometryVersion,
		readPlacement,
		press,
		startDrag,
		moveDrag,
		release,
		completeDrop,
		cancel,
	} = useTileSystemApiContext();
	return {
		geometryVersion,
		readPlacement,
		press,
		startDrag,
		moveDrag,
		release,
		completeDrop,
		cancel,
	};
};
