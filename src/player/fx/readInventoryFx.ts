import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { defaultSaveGameId } from "~/play/logic/save";
import type { PlayerInventorySlot, PlayerInventoryView } from "~/play/logic/playTypes";
import { groupSlotsByItemId } from "~/player/logic/groupSlotsByItemId";
import { readEffectivePlayerInventorySlots } from "~/upgrade/logic/readEffectivePlayerInventorySlots";

export const readInventoryFx = Effect.fn("readInventoryFx")(function* () {
	const gameConfig = yield* GameConfigServiceFx;
	const [rows, upgradeRows] = yield* dbFx((db) =>
		Promise.all([
			db
				.selectFrom(table.playerInventoryStack)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.orderBy("slotIndex")
				.execute(),
			db
				.selectFrom(table.playerUpgrade)
				.selectAll()
				.where("saveGameId", "=", defaultSaveGameId)
				.execute(),
		]),
	);
	const capacity = readEffectivePlayerInventorySlots(gameConfig, upgradeRows);
	const stacksBySlot = new Map(
		rows.map((row) => [
			row.slotIndex,
			row,
		]),
	);
	const slots = Array.from(
		{
			length: capacity,
		},
		(_, slotIndex): PlayerInventorySlot => {
			const stack = stacksBySlot.get(slotIndex);
			return {
				slotIndex,
				stack: stack
					? {
							id: stack.id,
							itemId: stack.itemDefinitionId,
							quantity: stack.quantity,
						}
					: undefined,
			};
		},
	);

	return {
		slots,
		capacity,
		bySlotIndex: Object.fromEntries(
			slots.map((slot) => [
				slot.slotIndex,
				slot,
			]),
		),
		stacksByItemId: groupSlotsByItemId(slots),
		firstEmptySlotIndex: slots.find((slot) => !slot.stack)?.slotIndex,
	} satisfies PlayerInventoryView;
});
