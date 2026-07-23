import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

/** Exposes only actor-owned interaction commands and placement measurement. */
export const useTileActorSystem = () => {
	const {
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
	} = useTileSystemApiContext();
	return {
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
