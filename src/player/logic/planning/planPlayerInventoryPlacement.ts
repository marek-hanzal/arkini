import type { IdService } from "~/id/context/IdServiceFx";
import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import { GameActionError } from "~/play/logic/playTypes";
import type { PlayerInventoryPlacementPlan, PlayerInventoryRow } from "./types";

export namespace planPlayerInventoryPlacement {
	export interface Options {
		capacity: number;
		gameConfig: GameConfigService;
		id: IdService;
	}
}

export function planPlayerInventoryPlacement(
	rows: PlayerInventoryRow[],
	itemId: ItemId | string,
	quantity: number,
	options: planPlayerInventoryPlacement.Options,
): PlayerInventoryPlacementPlan[] | null {
	if (quantity <= 0) return [];
	const item = options.gameConfig.getItem(itemId);
	if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);

	let remaining = quantity;
	const plan: PlayerInventoryPlacementPlan[] = [];
	const stacks = [
		...rows,
	]
		.sort((left, right) => left.slotIndex - right.slotIndex)
		.filter((row) => row.itemDefinitionId === itemId && row.quantity < item.maxStackSize);

	for (const stack of stacks) {
		const add = Math.min(remaining, item.maxStackSize - stack.quantity);
		if (add <= 0) continue;
		stack.quantity += add;
		remaining -= add;
		plan.push({
			type: "update",
			stackId: stack.id,
			slotIndex: stack.slotIndex,
			itemId: itemId as ItemId,
			quantity: stack.quantity,
		});
		if (remaining <= 0) return plan;
	}

	for (let slotIndex = 0; slotIndex < options.capacity; slotIndex += 1) {
		if (rows.some((row) => row.slotIndex === slotIndex)) continue;
		const add = Math.min(remaining, item.maxStackSize);
		const stackId = options.id.playerInventoryVirtual();
		rows.push({
			id: stackId,
			itemDefinitionId: itemId,
			slotIndex,
			quantity: add,
		});
		remaining -= add;
		plan.push({
			type: "insert",
			stackId,
			slotIndex,
			itemId: itemId as ItemId,
			quantity: add,
		});
		if (remaining <= 0) return plan;
	}

	return null;
}
