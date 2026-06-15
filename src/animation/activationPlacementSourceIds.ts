import { boardSourceId } from "~/board/boardSourceId";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import type { ActivationPlacementSchema } from "~/activation/type/ActivationPlacementSchema";

export namespace activationPlacementSourceIds {
	export interface Props {
		placements: readonly ActivationPlacementSchema.Type[];
	}
}

export const activationPlacementSourceIds = ({ placements }: activationPlacementSourceIds.Props) =>
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
