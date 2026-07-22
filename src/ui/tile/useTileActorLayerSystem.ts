import { useTileSystemContext } from "~/ui/tile/useTileSystemContext";

/** Exposes actor-layer placement and transient scene lifecycle ownership. */
export const useTileActorLayerSystem = () => {
	const {
		active,
		registerActorLayer,
		resetInteraction,
		clearNeighbourField,
	} = useTileSystemContext();
	return {
		active,
		registerActorLayer,
		resetInteraction,
		clearNeighbourField,
	};
};
