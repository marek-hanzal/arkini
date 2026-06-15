import { Effect } from "effect";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";
import { insertBoardItemFx } from "~/v0/board/fx/insertBoardItemFx";
import { readActivationInputRowsFx } from "~/v0/activation/fx/readActivationInputRowsFx";
import { readCraftInputRowsFx } from "~/v0/craft/fx/readCraftInputRowsFx";
import { assertInsideBoard } from "~/v0/board/logic/assertInsideBoard";
import { resumeCraftTimer } from "~/v0/board/logic/resumeCraftTimer";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { spendInventoryStackFx } from "~/v0/inventory/fx/spendInventoryStackFx";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { PlaceInventoryItemInputSchema } from "~/v0/inventory/schema/PlaceInventoryItemInputSchema";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import type { InventoryPlaceResult } from "~/v0/inventory/view/InventoryPlaceResultSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { json } from "~/v0/serialization/json";
import { parseJson } from "~/v0/serialization/parseJson";

export namespace placeInventoryItemFx {
	export interface Props {
		slotIndex: number;
		x: number;
		y: number;
	}
}

export const placeInventoryItemFx = Effect.fn("placeInventoryItemFx")(function* (
	props: placeInventoryItemFx.Props,
) {
	const input = yield* Effect.tryPromise({
		try: () => PlaceInventoryItemInputSchema.parseAsync(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const { save, boardRows, inventoryRows } = yield* readMutableSaveFx();
			assertInsideBoard(save, input.x, input.y);

			const stack = inventoryRows.find((row) => row.slotIndex === input.slotIndex);
			if (!stack) {
				return yield* Effect.fail(new GameActionError("Inventory slot is empty."));
			}
			if (boardRows.some((row) => row.x === input.x && row.y === input.y)) {
				return yield* Effect.fail(new GameActionError("Board cell is occupied."));
			}

			const resumedState = resumeCraftTimer(
				parseJson<BoardItemState>(stack.stateJson || "{}"),
				date,
			);
			const [activationInputRows, craftInputRows] = yield* Effect.all([
				readActivationInputRowsFx({
					ownerItemInstanceIds: [
						stack.id,
					],
				}),
				readCraftInputRowsFx({
					ownerItemInstanceIds: [
						stack.id,
					],
				}),
			]);

			if (
				stack.quantity === 1 ||
				activationInputRows.length > 0 ||
				craftInputRows.length > 0
			) {
				yield* dbFx((db) =>
					db
						.updateTable("itemInstance")
						.set({
							quantity: 1,
							locationKind: "board",
							boardX: input.x,
							boardY: input.y,
							inventorySlotIndex: null,
							ownerItemInstanceId: null,
							inputItemDefinitionId: null,
							stateJson: json(resumedState),
							updatedAt: date.timestamp(),
						})
						.where("id", "=", stack.id)
						.execute(),
				);

				const inventoryPlace = {
					boardItemId: stack.id,
					itemId: stack.itemDefinitionId as ItemId,
					x: input.x,
					y: input.y,
				} satisfies InventoryPlaceResult;

				return {
					inventoryPlace,
					visualEvents: [
						{
							type: "item.moved",
							itemInstanceId: inventoryPlace.boardItemId,
							itemId: stack.itemDefinitionId as ItemId,
							from: {
								kind: "inventory",
								slotIndex: input.slotIndex,
							},
							to: {
								kind: "board",
								x: input.x,
								y: input.y,
							},
						},
					],
				} satisfies ActionResultSchema.Type & {
					inventoryPlace: InventoryPlaceResult;
				};
			}

			const boardItemId = yield* insertBoardItemFx({
				itemId: stack.itemDefinitionId as ItemId,
				x: input.x,
				y: input.y,
				stateJson: json(resumedState),
			});
			yield* spendInventoryStackFx({
				stack,
				quantity: 1,
			});

			const inventoryPlace = {
				boardItemId,
				itemId: stack.itemDefinitionId as ItemId,
				x: input.x,
				y: input.y,
			} satisfies InventoryPlaceResult;

			return {
				inventoryPlace,
				visualEvents: [
					{
						type: "item.spawned",
						itemInstanceId: boardItemId,
						itemId: stack.itemDefinitionId as ItemId,
						from: {
							kind: "inventory",
							slotIndex: input.slotIndex,
						},
						to: {
							kind: "board",
							x: input.x,
							y: input.y,
						},
						reason: "inventory-placement",
					},
				],
			} satisfies ActionResultSchema.Type & {
				inventoryPlace: InventoryPlaceResult;
			};
		}),
	);
});
