import { placeFx } from "~/inventory/fx/placeFx";
import { stashFx } from "~/inventory/fx/stashFx";
import { swapFx } from "~/inventory/fx/swapFx";
import { runEffect } from "~/play/logic/runEffect";

export namespace placeInventoryItem {
	export interface Props {
		slotIndex: number;
		x: number;
		y: number;
	}
}

export const placeInventoryItem = ({ slotIndex, x, y }: placeInventoryItem.Props) =>
	runEffect(
		placeFx({
			slotIndex,
			x,
			y,
		}),
	);

export namespace swapInventorySlots {
	export interface Props {
		sourceSlotIndex: number;
		targetSlotIndex: number;
	}
}

export const swapInventorySlots = ({
	sourceSlotIndex,
	targetSlotIndex,
}: swapInventorySlots.Props) =>
	runEffect(
		swapFx({
			sourceSlotIndex,
			targetSlotIndex,
		}),
	);

export namespace stashBoardItem {
	export interface Props {
		boardItemId: string;
		slotIndex?: number;
	}
}

export const stashBoardItem = ({ boardItemId, slotIndex }: stashBoardItem.Props) =>
	runEffect(
		stashFx({
			boardItemId,
			slotIndex,
		}),
	);
