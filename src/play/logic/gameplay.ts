import { mergeFx as boardMergeFx } from "~/board/logic/fx/mergeFx";
import { moveFx as boardMoveFx } from "~/board/logic/fx/moveFx";
import { swapFx as boardSwapFx } from "~/board/logic/fx/swapFx";
import { buildFx } from "~/build/logic/fx/buildFx";
import { placeFx as inventoryPlaceFx } from "~/inventory/logic/fx/placeFx";
import { stashFx as inventoryStashFx } from "~/inventory/logic/fx/stashFx";
import { swapFx as inventorySwapFx } from "~/inventory/logic/fx/swapFx";
import { runFx } from "~/play/logic/fx/runFx";
import { produceFx } from "~/producer/logic/fx/produceFx";

export function placeInventoryItem(slotIndex: number, x: number, y: number) {
	return runFx(
		inventoryPlaceFx({
			slotIndex,
			x,
			y,
		}),
	);
}

export function swapInventorySlots(sourceSlotIndex: number, targetSlotIndex: number) {
	return runFx(
		inventorySwapFx({
			sourceSlotIndex,
			targetSlotIndex,
		}),
	);
}

export function stashBoardItem(boardItemId: string, slotIndex?: number) {
	return runFx(
		inventoryStashFx({
			boardItemId,
			slotIndex,
		}),
	);
}

export function moveBoardItem(boardItemId: string, x: number, y: number) {
	return runFx(
		boardMoveFx({
			boardItemId,
			x,
			y,
		}),
	);
}

export function swapBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
	return runFx(
		boardSwapFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);
}

export function mergeBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
	return runFx(
		boardMergeFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);
}

export function produceBoardItem(boardItemId: string, activation: "single" | "exhaust" = "single") {
	return runFx(
		produceFx({
			boardItemId,
			activation,
		}),
	);
}

export function buildRecipe(recipeId: string, x: number, y: number) {
	return runFx(
		buildFx({
			recipeId,
			x,
			y,
		}),
	);
}
