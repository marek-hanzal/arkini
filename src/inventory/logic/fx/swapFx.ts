import { Effect } from "effect";
import { assertInsideInventory } from "~/board/logic/gameBounds";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { getItem } from "~/play/logic/gameDefinitionLookup";
import { SwapInventorySlotsInputSchema } from "~/play/logic/gameActionSchemas";
import { readMutableSaveFx } from "~/play/logic/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/fx/toGameActionError";
import { tryGameActionFx } from "~/play/logic/fx/tryGameActionFx";
import { localTimestamp } from "~/play/logic/localTimestamp";
import { GameActionError } from "~/play/logic/playTypes";
import { spendStackFx } from "./spendStackFx";

export namespace swapFx {
	export interface Props {
		sourceSlotIndex: number;
		targetSlotIndex: number;
	}
}

export const swapFx = Effect.fn("swapFx")(function* (props: swapFx.Props) {
	const input = yield* Effect.try({
		try: () => SwapInventorySlotsInputSchema.parse(props),
		catch: toGameActionError,
	});
	if (input.sourceSlotIndex === input.targetSlotIndex) return;

	yield* tryGameActionFx(() =>
		db.transaction().execute((tx) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const { save, inventoryRows } = yield* readMutableSaveFx({
						tx,
					});
					assertInsideInventory(save, input.sourceSlotIndex);
					assertInsideInventory(save, input.targetSlotIndex);

					const source = inventoryRows.find(
						(row) => row.slotIndex === input.sourceSlotIndex,
					);
					const target = inventoryRows.find(
						(row) => row.slotIndex === input.targetSlotIndex,
					);
					if (!source)
						return yield* Effect.fail(new GameActionError("Inventory slot is empty."));

					if (target && target.itemDefinitionId === source.itemDefinitionId) {
						const item = getItem(source.itemDefinitionId);
						const movable = Math.min(
							source.quantity,
							item.maxStackSize - target.quantity,
						);
						if (movable <= 0) return;
						yield* tryGameActionFx(() =>
							tx
								.updateTable(table.inventoryStack)
								.set({
									quantity: target.quantity + movable,
									updatedAt: localTimestamp(),
								})
								.where("id", "=", target.id)
								.execute(),
						);
						yield* spendStackFx({
							tx,
							stack: source,
							quantity: movable,
						});
						return;
					}

					if (!target) {
						yield* tryGameActionFx(() =>
							tx
								.updateTable(table.inventoryStack)
								.set({
									slotIndex: input.targetSlotIndex,
									updatedAt: localTimestamp(),
								})
								.where("id", "=", source.id)
								.execute(),
						);
						return;
					}

					yield* tryGameActionFx(() =>
						tx
							.updateTable(table.inventoryStack)
							.set({
								slotIndex: -1,
								updatedAt: localTimestamp(),
							})
							.where("id", "=", source.id)
							.execute(),
					);
					yield* tryGameActionFx(() =>
						tx
							.updateTable(table.inventoryStack)
							.set({
								slotIndex: input.sourceSlotIndex,
								updatedAt: localTimestamp(),
							})
							.where("id", "=", target.id)
							.execute(),
					);
					yield* tryGameActionFx(() =>
						tx
							.updateTable(table.inventoryStack)
							.set({
								slotIndex: input.targetSlotIndex,
								updatedAt: localTimestamp(),
							})
							.where("id", "=", source.id)
							.execute(),
					);
				}),
			),
		),
	);
});
