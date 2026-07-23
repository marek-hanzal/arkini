import { useTileSystemContext } from "~/ui/tile/useTileSystemContext";

/** Exposes only actor-owned interaction commands and placement measurement. */
export const useTileActorSystem = () => {
	const {
		active,
		geometryVersion,
		readActorLayerRect,
		readActorRect,
		readActorSource,
		readPlacement,
		press,
		startDrag,
		moveDrag,
		release,
		settle,
		complete,
		cancel,
		registerNeighbourActor,
		updateNeighbourActor,
		beginNeighbourTravel,
		setNeighbourTravelTarget,
		setNeighbourSemanticSource,
		clearNeighbourField,
	} = useTileSystemContext();
	return {
		active,
		geometryVersion,
		readActorLayerRect,
		readActorRect,
		readActorSource,
		readPlacement,
		press,
		startDrag,
		moveDrag,
		release,
		settle,
		complete,
		cancel,
		registerNeighbourActor,
		updateNeighbourActor,
		beginNeighbourTravel,
		setNeighbourTravelTarget,
		setNeighbourSemanticSource,
		clearNeighbourField,
	};
};
