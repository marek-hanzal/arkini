import { Effect } from "effect";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import { readActivationInputRowsFx } from "~/v0/activation/fx/readActivationInputRowsFx";
import { readCraftInputRowsFx } from "~/v0/craft/fx/readCraftInputRowsFx";
import { pauseCraftTimer } from "~/v0/board/logic/pauseCraftTimer";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { StashBoardItemInputSchema } from "~/v0/inventory/schema/StashBoardItemInputSchema";
import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import { parseJson } from "~/v0/serialization/parseJson";
import { json } from "~/v0/serialization/json";
import { emptyInventoryStateJson } from "~/v0/inventory/logic/emptyInventoryStateJson";
import { isEmptyInventoryStateJson } from "~/v0/inventory/logic/isEmptyInventoryStateJson";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";

export namespace stashBoardItemFx {
	export interface Props {
		boardItemId: string;
		slotIndex?: number;
	}
}

export const stashBoardItemFx = Effect.fn("stashBoardItemFx")(function* (
	props: stashBoardItemFx.Props,
) {
	const input = yield* Effect.tryPromise({
		try: () => StashBoardItemInputSchema.parseAsync(props),
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

			const [activationInputRows, craftInputRows] = yield* Effect.all([
				readActivationInputRowsFx({
					ownerItemInstanceIds: [
						boardItem.id,
					],
				}),
				readCraftInputRowsFx({
					ownerItemInstanceIds: [
						boardItem.id,
					],
				}),
			]);
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

			const hasNestedInputs = activationInputRows.length > 0 || craftInputRows.length > 0;
			const canStack = !hasNestedInputs && isEmptyInventoryStateJson(stateJson);
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
							.updateTable("itemInstance")
							.set({
								quantity: stack.quantity + 1,
								updatedAt,
							})
							.where("id", "=", stack.id)
							.execute();
						await db
							.deleteFrom("itemInstance")
							.where("id", "=", boardItem.id)
							.execute();
					});
					return {
						visualEvents: [
							{
								type: "inventory.stacked",
								animation: ActionVisualAnimation.parallelMove({
									cause: "inventory",
									groupId: `stash-stack:${boardItem.id}:${stack.id}`,
								}),
								sourceItemInstanceId: boardItem.id,
								targetItemInstanceId: stack.id,
								itemId: boardItem.itemDefinitionId as ItemId,
								quantity: stack.quantity + 1,
							},
						],
					} satisfies ActionResultSchema.Type;
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
							.updateTable("itemInstance")
							.set({
								quantity: targetStack.quantity + 1,
								updatedAt,
							})
							.where("id", "=", targetStack.id)
							.execute();
						await db
							.deleteFrom("itemInstance")
							.where("id", "=", boardItem.id)
							.execute();
					});
					return {
						visualEvents: [
							{
								type: "inventory.stacked",
								animation: ActionVisualAnimation.parallelMove({
									cause: "inventory",
									groupId: `stash-stack:${boardItem.id}:${targetStack.id}`,
								}),
								sourceItemInstanceId: boardItem.id,
								targetItemInstanceId: targetStack.id,
								itemId: boardItem.itemDefinitionId as ItemId,
								quantity: targetStack.quantity + 1,
							},
						],
					} satisfies ActionResultSchema.Type;
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
					.updateTable("itemInstance")
					.set({
						quantity: 1,
						locationKind: "inventory",
						boardX: null,
						boardY: null,
						inventorySlotIndex: targetSlotIndex,
						ownerItemInstanceId: null,
						inputItemDefinitionId: null,
						stateJson: hasNestedInputs
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
						animation: ActionVisualAnimation.parallelMove({
							cause: "inventory",
							groupId: `stash-move:${boardItem.id}:${targetSlotIndex}`,
						}),
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
			} satisfies ActionResultSchema.Type;
		}),
	);
});
