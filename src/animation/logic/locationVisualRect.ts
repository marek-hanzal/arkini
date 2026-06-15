import { inventorySinkRect } from "~/inventory/util/inventory";
import type { ItemLocationSchema } from "~/item-instance/type/ItemLocationSchema";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { RectLike } from "~/play/types";
import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";
import { actorVisualRect } from "./actorVisualRect";

export namespace locationVisualRect {
	export interface Props {
		location: ItemLocationSchema.Type;
		itemInstanceId?: string;
		activeSheet?: ActiveSheet;
		fallbackSourceRect?: RectLike | null;
	}
}

export const locationVisualRect = ({
	location,
	itemInstanceId,
	activeSheet,
	fallbackSourceRect,
}: locationVisualRect.Props) => {
	if (location.kind === "board") {
		return (
			actorVisualRect({
				itemInstanceId,
			}) ?? queryPaddingBoxRect(`[data-board-cell="${location.x}:${location.y}"]`)
		);
	}

	if (location.kind === "inventory") {
		const rect =
			activeSheet === "inventory"
				? (queryPaddingBoxRect(`[data-inventory-slot-tile="${location.slotIndex}"]`) ??
					queryPaddingBoxRect(`[data-inventory-slot="${location.slotIndex}"]`))
				: null;
		return rect ?? (fallbackSourceRect ? inventorySinkRect(fallbackSourceRect) : null);
	}

	return actorVisualRect({
		itemInstanceId: location.ownerItemInstanceId,
	});
};
