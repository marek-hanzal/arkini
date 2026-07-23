import { useTileSystemApiContext } from "~/ui/tile/useTileSystemApiContext";

/** Exposes only slot registration and the active interaction needed for hover feedback. */
export const useTileSlotSystem = () => {
	const { refreshSlotTarget, registerSlot } = useTileSystemApiContext();
	return {
		refreshSlotTarget,
		registerSlot,
	};
};
