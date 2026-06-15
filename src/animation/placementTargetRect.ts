import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { ActivationPlacementSchema } from "~/activation/type/ActivationPlacementSchema";
import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";

export namespace placementTargetRect {
	export interface Props {
		placement: ActivationPlacementSchema.Type;
		activeSheet?: ActiveSheet;
	}
}

export const placementTargetRect = ({ placement, activeSheet }: placementTargetRect.Props) => {
	if (placement.kind === "board")
		return queryPaddingBoxRect(`[data-board-cell="${placement.x}:${placement.y}"]`);
	if (activeSheet !== "inventory") return null;
	return queryPaddingBoxRect(`[data-inventory-slot="${placement.slotIndex}"]`);
};
