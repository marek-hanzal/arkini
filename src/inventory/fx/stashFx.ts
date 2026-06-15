import { Effect } from "effect";
import { readActivationInputRowsFx } from "~/activation/fx/readActivationInputRowsFx";
import { pauseCraftTimer } from "~/board/logic/pauseCraftTimer";
import { GameActionError } from "~/command/GameActionError";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { StashBoardItemInputSchema } from "~/play/schema/StashBoardItemInputSchema";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import { parseJson } from "~/shared/parseJson";
import { json } from "~/shared/json";
import { emptyInventoryStateJson } from "~/inventory/logic/emptyInventoryStateJson";
import { isEmptyInventoryStateJson } from "~/inventory/logic/isEmptyInventoryStateJson";
import type { CommandResultSchema } from "~/command/CommandResultSchema";

export namespace stashFx {
	export interface Props {
		boardItemId: string;
		slotIndex?: number;
	}
}

export const stashFx = Effect.fn("stashFx")(function* (props: stashFx.Props) {
	const input = yield* Effect.try({
		try: () => StashBoardItemInputSchema.parse(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const gameConfig = yield* GameConfigServiceFx;
			const date = yield* DateServiceFx;
			const updatedAt = date.timestamp();
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			const boardItem = boardRows.find((row) => row.id === input.boardItemId);
			if (!boardItem) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}

			const inputRows = yield* readActivationInputRowsFx({
				ownerItemInstanceIds: [
					boardItem.id,
				],
			});
			const pausedState = pauseCraftTimer(
				parseJson<BoardItemState>(boardItem.stateJson || "{}"),
				date,
			);
			const stateJson = json(pausedState);
			const item = gameConfig.getItem(boardItem.itemDefinitionId as ItemId);
			if (!item) {
				return yield* Effect.fail(
					new GameActionError(`Unknown item definition ${boardItem.itemDefinitionId}.`),
				);
			}

			const hasActivationInputs = inputRows.length > 0;
			const canStack = !hasActivationInputs && isEmptyInventoryStateJson(stateJson);
			if (canStack) {
				const stack = inventoryRows
					.filter(
						(row) =>
							row.itemDefinitionId === boardItem.itemDefinitionId &&
							isEmptyInventoryStateJson(row.stateJson) &&
							row.quantity < item.maxStackSize,
					)
					.sort((left, right) => left.slotIndex - right.slotIndex)[0];

				if (stack && input.slotIndex === undefined) {
					yield* dbFx(async (db) => {
						await db
							.updateTable(table.itemInstance)
							.set({
								quantity: stack.quantity + 1,
								updatedAt,
							})
							.where("id", "=", stack.id)
							.execute();
						await db
							.deleteFrom(table.itemInstance)
							.where("id", "=", boardItem.id)
							.execute();
					});
					return {
						visualEvents: [
							{
								type: "inventory.stacked",
								sourceItemInstanceId: boardItem.id,
								targetItemInstanceId: stack.id,
								itemId: boardItem.itemDefinitionId as ItemId,
								quantity: stack.quantity + 1,
							},
						],
					} satisfies CommandResultSchema.Type;
				}

				const targetStack =
					input.slotIndex === undefined
						? undefined
						: inventoryRows.find((row) => row.slotIndex === input.slotIndex);
				if (targetStack) {
					if (
						targetStack.itemDefinitionId !== boardItem.itemDefinitionId ||
						!isEmptyInventoryStateJson(targetStack.stateJson) ||
						targetStack.quantity >= item.maxStackSize
					) {
						return yield* Effect.fail(
							new GameActionError("Inventory slot cannot accept this item."),
						);
					}

					yield* dbFx(async (db) => {
						await db
							.updateTable(table.itemInstance)
							.set({
								quantity: targetStack.quantity + 1,
								updatedAt,
							})
							.where("id", "=", targetStack.id)
							.execute();
						await db
							.deleteFrom(table.itemInstance)
							.where("id", "=", boardItem.id)
							.execute();
					});
					return {
						visualEvents: [
							{
								type: "inventory.stacked",
								sourceItemInstanceId: boardItem.id,
								targetItemInstanceId: targetStack.id,
								itemId: boardItem.itemDefinitionId as ItemId,
								quantity: targetStack.quantity + 1,
							},
						],
					} satisfies CommandResultSchema.Type;
				}
			}

			const occupiedSlots = new Set(inventoryRows.map((row) => row.slotIndex));
			const targetSlotIndex =
				input.slotIndex ??
				Array.from(
					{
						length: save.inventorySlots,
					},
					(_, index) => index,
				).find((slotIndex) => !occupiedSlots.has(slotIndex));
			if (targetSlotIndex === undefined) {
				return yield* Effect.fail(
					new GameActionError(
						input.slotIndex === undefined
							? "Inventory is full."
							: "Inventory slot cannot accept this item.",
					),
				);
			}
			if (targetSlotIndex < 0 || targetSlotIndex >= save.inventorySlots) {
				return yield* Effect.fail(
					new GameActionError("Inventory slot is outside the inventory."),
				);
			}
			if (occupiedSlots.has(targetSlotIndex)) {
				return yield* Effect.fail(
					new GameActionError("Inventory slot cannot accept this item."),
				);
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.itemInstance)
					.set({
						quantity: 1,
						locationKind: "inventory",
						boardX: null,
						boardY: null,
						inventorySlotIndex: targetSlotIndex,
						ownerItemInstanceId: null,
						inputItemDefinitionId: null,
						stateJson: hasActivationInputs
							? stateJson
							: stateJson || emptyInventoryStateJson,
						updatedAt,
					})
					.where("id", "=", boardItem.id)
					.execute(),
			);

			return {
				visualEvents: [
					{
						type: "item.moved",
						itemInstanceId: boardItem.id,
						itemId: boardItem.itemDefinitionId as ItemId,
						from: {
							kind: "board",
							x: boardItem.x,
							y: boardItem.y,
						},
						to: {
							kind: "inventory",
							slotIndex: targetSlotIndex,
						},
					},
				],
			} satisfies CommandResultSchema.Type;
		}),
	);
});
