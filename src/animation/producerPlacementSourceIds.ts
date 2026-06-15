import { boardSourceId } from "~/board/boardSourceId";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import type { ProducerPlacement } from "~/play/logic/playTypes";

export namespace producerPlacementSourceIds {
	export interface Props {
		placements: readonly ProducerPlacement[];
	}
}

export const producerPlacementSourceIds = ({ placements }: producerPlacementSourceIds.Props) =>
	placements.flatMap((placement) => {
		if (placement.kind === "board" && placement.boardItemId) {
			return [
				boardSourceId(placement.boardItemId),
			];
		}

		if (placement.kind === "inventory" && placement.slotIndex !== undefined) {
			return [
				inventorySourceId(placement.slotIndex),
			];
		}

		return [];
	});
