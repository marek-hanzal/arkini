import { Effect } from "effect";
import { assertInsideBoard } from "~/board/logic/assertInsideBoard";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { MoveBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";

export namespace moveFx {
	export interface Props {
		boardItemId: string;
		x: number;
		y: number;
	}
}

export const moveFx = Effect.fn("moveFx")(function* (props: moveFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const input = yield* Effect.try({
		try: () => MoveBoardItemInputSchema.parse(props),
		catch: toGameActionError,
	});

	yield* withTransactionFx(
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
					.updateTable(table.boardItem)
					.set({
						x: input.x,
						y: input.y,
						updatedAt: timestamp,
					})
					.where("id", "=", boardItem.id)
					.execute(),
			);
		}),
	);
});
