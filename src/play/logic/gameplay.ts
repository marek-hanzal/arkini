import { mergeFx as boardMergeFx } from "~/board/fx/mergeFx";
import { moveFx as boardMoveFx } from "~/board/fx/moveFx";
import { swapFx as boardSwapFx } from "~/board/fx/swapFx";
import { placeFx as inventoryPlaceFx } from "~/inventory/fx/placeFx";
import { stashFx as inventoryStashFx } from "~/inventory/fx/stashFx";
import { swapFx as inventorySwapFx } from "~/inventory/fx/swapFx";
import { runEffect } from "~/play/logic/runEffect";
import { buyFx as upgradeBuyFx } from "~/upgrade/fx/buyFx";
import { produceFx } from "~/producer/fx/produceFx";
import { withdrawInputFx as producerWithdrawInputFx } from "~/producer/fx/withdrawInputFx";

export function placeInventoryItem(slotIndex: number, x: number, y: number) {
	return runEffect(
		inventoryPlaceFx({
			slotIndex,
			x,
			y,
		}),
	);
}

export function swapInventorySlots(sourceSlotIndex: number, targetSlotIndex: number) {
	return runEffect(
		inventorySwapFx({
			sourceSlotIndex,
			targetSlotIndex,
		}),
	);
}

export function stashBoardItem(boardItemId: string, slotIndex?: number) {
	return runEffect(
		inventoryStashFx({
			boardItemId,
			slotIndex,
		}),
	);
}

export function moveBoardItem(boardItemId: string, x: number, y: number) {
	return runEffect(
		boardMoveFx({
			boardItemId,
			x,
			y,
		}),
	);
}

export function swapBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
	return runEffect(
		boardSwapFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);
}

export function mergeBoardItems(sourceBoardItemId: string, targetBoardItemId: string) {
	return runEffect(
		boardMergeFx({
			sourceBoardItemId,
			targetBoardItemId,
		}),
	);
}

export function produceBoardItem(boardItemId: string, activation: "single" | "exhaust" = "single") {
	return runEffect(
		produceFx({
			boardItemId,
			activation,
		}),
	);
}

export function buyUpgrade(upgradeId: string) {
	return runEffect(
		upgradeBuyFx({
			upgradeId,
		}),
	);
}

export function withdrawProducerInput(boardItemId: string, itemId: string) {
	return runEffect(
		producerWithdrawInputFx({
			boardItemId,
			itemId,
		}),
	);
}
