import type { useTileGeometry } from "~/ui/tile/useTileGeometry";
import type { useTileInteractionController } from "~/ui/tile/useTileInteractionController";
import type { useTileNeighbourField } from "~/ui/tile/useTileNeighbourField";

/** Complete Canvas-local tile contract used by focused integration fixtures. */
export type TileSystem = Omit<ReturnType<typeof useTileGeometry>, "resolveTarget"> &
	Omit<
		ReturnType<typeof useTileInteractionController>,
		"readActive" | "subscribeActive" | "refreshSlotTarget"
	> &
	ReturnType<typeof useTileNeighbourField>;
