import { useTileSystemContext } from "~/ui/tile/useTileSystemContext";

/** Exposes only actor-owned interaction commands and placement measurement. */
export const useTileActorSystem = () => {
	const {
		active,
		geometryVersion,
		readPlacement,
		press,
		startDrag,
		moveDrag,
		release,
		settle,
		complete,
		cancel,
	} = useTileSystemContext();
	return {
		active,
		geometryVersion,
		readPlacement,
		press,
		startDrag,
		moveDrag,
		release,
		settle,
		complete,
		cancel,
	};
};
