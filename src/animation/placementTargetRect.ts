import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { ProducerPlacement } from "~/play/logic/playTypes";
import { queryRect } from "~/shared/util/queryRect";

export namespace placementTargetRect {
	export interface Props {
		placement: ProducerPlacement;
		activeSheet?: ActiveSheet;
	}
}

export const placementTargetRect = ({ placement, activeSheet }: placementTargetRect.Props) => {
	if (placement.kind === "board")
		return queryRect(`[data-board-cell="${placement.x}:${placement.y}"]`);
	if (activeSheet !== "inventory") return null;
	return queryRect(`[data-inventory-slot="${placement.slotIndex}"]`);
};
