import type { mergeBoardItemsFx } from "~/v0/board/fx/mergeBoardItemsFx";
import type { moveBoardItemFx } from "~/v0/board/fx/moveBoardItemFx";
import type { swapBoardItemsFx as boardSwapFx } from "~/v0/board/fx/swapBoardItemsFx";
import type { placeInventoryItemFx } from "~/v0/inventory/fx/placeInventoryItemFx";
import type { stashBoardItemFx } from "~/v0/inventory/fx/stashBoardItemFx";
import type { swapInventorySlotsFx as inventorySwapFx } from "~/v0/inventory/fx/swapInventorySlotsFx";

export interface DropActions {
	moveBoardItem(input: moveBoardItemFx.Props): Promise<unknown>;
	swapBoardItems(input: boardSwapFx.Props): Promise<unknown>;
	mergeBoardItems(input: mergeBoardItemsFx.Props): Promise<unknown>;
	placeInventoryItem(input: placeInventoryItemFx.Props): Promise<unknown>;
	stashBoardItem(input: stashBoardItemFx.Props): Promise<unknown>;
	swapInventorySlots(input: inventorySwapFx.Props): Promise<unknown>;
}
