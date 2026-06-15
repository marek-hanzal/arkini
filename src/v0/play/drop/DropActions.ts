import type { mergeFx } from "~/board/fx/mergeFx";
import type { moveFx } from "~/board/fx/moveFx";
import type { swapFx as boardSwapFx } from "~/board/fx/swapFx";
import type { placeFx } from "~/inventory/fx/placeFx";
import type { stashFx } from "~/inventory/fx/stashFx";
import type { swapFx as inventorySwapFx } from "~/inventory/fx/swapFx";

export interface DropActions {
	moveBoardItem(input: moveFx.Props): Promise<unknown>;
	swapBoardItems(input: boardSwapFx.Props): Promise<unknown>;
	mergeBoardItems(input: mergeFx.Props): Promise<unknown>;
	placeInventoryItem(input: placeFx.Props): Promise<unknown>;
	stashBoardItem(input: stashFx.Props): Promise<unknown>;
	swapInventorySlots(input: inventorySwapFx.Props): Promise<unknown>;
}
