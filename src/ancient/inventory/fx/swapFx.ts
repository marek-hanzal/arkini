import { Effect } from "effect";
import { assertInsideInventory } from "~/board/logic/assertInsideInventory";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { SwapInventorySlotsInputSchema } from "~/play/schema/SwapInventorySlotsInputSchema";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameActionError } from "~/command/GameActionError";
import { toGameActionError } from "~/play/logic/toGameActionError";
import type { CommandResultSchema } from "~/command/CommandResultSchema";

export namespace swapFx {
	export interface Props {
		sourceSlotIndex: number;
		targetSlotIndex: number;
	}
}

export const swapFx = Effect.fn("swapFx")(function* (props: swapFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const input = yield* Effect.tryPromise({
		try: () => SwapInventorySlotsInputSchema.parseAsync(props),
		catch: toGameActionError,
	});
	if (input.sourceSlotIndex === input.targetSlotIndex) {
		return {
			visualEvents: [],
		} satisfies CommandResultSchema.Type;
	}

	return yield* withTransactionFx(
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
						.updateTable("itemInstance")
						.set({
							inventorySlotIndex: input.targetSlotIndex,
							updatedAt: timestamp,
						})
						.where("id", "=", source.id)
						.execute(),
				);
				return {
					visualEvents: [
						{
							type: "item.moved",
							itemInstanceId: source.id,
							itemId: source.itemDefinitionId,
							from: {
								kind: "inventory",
								slotIndex: input.sourceSlotIndex,
							},
							to: {
								kind: "inventory",
								slotIndex: input.targetSlotIndex,
							},
						},
					],
				} satisfies CommandResultSchema.Type;
			}

			yield* dbFx((db) =>
				db
					.updateTable("itemInstance")
					.set({
						inventorySlotIndex: -1,
						updatedAt: timestamp,
					})
					.where("id", "=", source.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable("itemInstance")
					.set({
						inventorySlotIndex: input.sourceSlotIndex,
						updatedAt: timestamp,
					})
					.where("id", "=", target.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable("itemInstance")
					.set({
						inventorySlotIndex: input.targetSlotIndex,
						updatedAt: timestamp,
					})
					.where("id", "=", source.id)
					.execute(),
			);

			return {
				visualEvents: [
					{
						type: "item.swapped",
						sourceItemInstanceId: source.id,
						sourceItemId: source.itemDefinitionId,
						sourceFrom: {
							kind: "inventory",
							slotIndex: input.sourceSlotIndex,
						},
						sourceTo: {
							kind: "inventory",
							slotIndex: input.targetSlotIndex,
						},
						targetItemInstanceId: target.id,
						targetItemId: target.itemDefinitionId,
						targetFrom: {
							kind: "inventory",
							slotIndex: input.targetSlotIndex,
						},
						targetTo: {
							kind: "inventory",
							slotIndex: input.sourceSlotIndex,
						},
					},
				],
			} satisfies CommandResultSchema.Type;
		}),
	);
});
