import { Effect } from "effect";
import { assertInsideInventory } from "~/board/logic/assertInsideInventory";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { SwapInventorySlotsInputSchema } from "~/play/schema/SwapInventorySlotsInputSchema";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameActionError } from "~/command/GameActionError";
import { toGameActionError } from "~/play/logic/toGameActionError";

export namespace swapFx {
	export interface Props {
		sourceSlotIndex: number;
		targetSlotIndex: number;
	}
}

export const swapFx = Effect.fn("swapFx")(function* (props: swapFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const input = yield* Effect.try({
		try: () => SwapInventorySlotsInputSchema.parse(props),
		catch: toGameActionError,
	});
	if (input.sourceSlotIndex === input.targetSlotIndex) return;

	yield* withTransactionFx(
		Effect.gen(function* () {
			const { save, inventoryRows } = yield* readMutableSaveFx();
			assertInsideInventory(save, input.sourceSlotIndex);
			assertInsideInventory(save, input.targetSlotIndex);

			const source = inventoryRows.find((row) => row.slotIndex === input.sourceSlotIndex);
			const target = inventoryRows.find((row) => row.slotIndex === input.targetSlotIndex);
			if (!source) {
				return yield* Effect.fail(new GameActionError("Inventory slot is empty."));
			}

			if (!target) {
				yield* dbFx((db) =>
					db
						.updateTable(table.inventoryStack)
						.set({
							slotIndex: input.targetSlotIndex,
							updatedAt: timestamp,
						})
						.where("id", "=", source.id)
						.execute(),
				);
				return;
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.inventoryStack)
					.set({
						slotIndex: -1,
						updatedAt: timestamp,
					})
					.where("id", "=", source.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable(table.inventoryStack)
					.set({
						slotIndex: input.sourceSlotIndex,
						updatedAt: timestamp,
					})
					.where("id", "=", target.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable(table.inventoryStack)
					.set({
						slotIndex: input.targetSlotIndex,
						updatedAt: timestamp,
					})
					.where("id", "=", source.id)
					.execute(),
			);
		}),
	);
});
