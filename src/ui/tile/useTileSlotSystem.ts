import { useTileSystemContext } from "~/ui/tile/useTileSystemContext";

/** Exposes only slot registration and the active interaction needed for hover feedback. */
export const useTileSlotSystem = () => {
	const { active, registerSlot } = useTileSystemContext();
	return {
		active,
		registerSlot,
	};
};
