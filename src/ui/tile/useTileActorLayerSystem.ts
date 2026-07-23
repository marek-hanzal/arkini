import { useTileInteractionState } from "~/ui/tile/useTileInteractionState";
import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

/** Exposes actor-layer placement and transient scene lifecycle ownership. */
export const useTileActorLayerSystem = () => {
	const active = useTileInteractionState();
	const { registerActorLayer, resetInteraction, clearNeighbourField } = useTileSystemApiContext();
	return {
		active,
		registerActorLayer,
		resetInteraction,
		clearNeighbourField,
	};
};
