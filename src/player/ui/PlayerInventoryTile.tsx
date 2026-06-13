import type { FC } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import type { PlayerInventorySlot, ViewItem } from "~/play/logic/playTypes";

export namespace PlayerInventoryTile {
	export interface Props {
		slot: PlayerInventorySlot;
		item: ViewItem;
	}
}

export const PlayerInventoryTile: FC<PlayerInventoryTile.Props> = ({ slot, item }) => {
	return (
		<GameItemView
			item={item}
			variant="inventory"
			quantity={slot.stack?.quantity}
		/>
	);
};
