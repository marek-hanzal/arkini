import { Effect } from "effect";
import { assertInsideBoard } from "~/v0/board/logic/assertInsideBoard";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { MoveBoardItemInputSchema } from "~/v0/board/schema/MoveBoardItemInputSchema";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { toGameActionError } from "~/v0/play/fx/toGameActionError";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";

export namespace moveBoardItemFx {
	export interface Props {
		boardItemId: string;
		x: number;
		y: number;
	}
}

export const moveBoardItemFx = Effect.fn("moveBoardItemFx")(function* (
	props: moveBoardItemFx.Props,
) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const input = yield* Effect.tryPromise({
		try: () => MoveBoardItemInputSchema.parseAsync(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const { save, boardRows } = yield* readMutableSaveFx();
			assertInsideBoard(save, input.x, input.y);

			const boardItem = boardRows.find((row) => row.id === input.boardItemId);
			if (!boardItem) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}
			const occupied = boardRows.find(
				(row) => row.x === input.x && row.y === input.y && row.id !== boardItem.id,
			);
			if (occupied) {
				return yield* Effect.fail(
					new GameActionError("Drop on an empty board cell or merge a valid recipe."),
				);
			}

			yield* dbFx((db) =>
				db
					.updateTable("itemInstance")
					.set({
						locationKind: "board",
						boardX: input.x,
						boardY: input.y,
						inventorySlotIndex: null,
						updatedAt: timestamp,
					})
					.where("id", "=", boardItem.id)
					.execute(),
			);

			return {
				visualEvents: [
					{
						type: "item.moved",
						itemInstanceId: boardItem.id,
						itemId: boardItem.itemDefinitionId,
						from: {
							kind: "board",
							x: boardItem.x,
							y: boardItem.y,
						},
						to: {
							kind: "board",
							x: input.x,
							y: input.y,
						},
					},
				],
			} satisfies ActionResultSchema.Type;
		}),
	);
});
