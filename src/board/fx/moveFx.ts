import { Effect } from "effect";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { assertInsideBoard } from "~/board/logic/gameBounds";
import { MoveBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { tryGameAction } from "~/play/logic/tryGameAction";
import { localTimestamp } from "~/play/logic/localTimestamp";
import { GameActionError } from "~/play/logic/playTypes";

export namespace moveFx {
	export interface Props {
		boardItemId: string;
		x: number;
		y: number;
	}
}

export const moveFx = Effect.fn("moveFx")(function* (props: moveFx.Props) {
	const input = yield* Effect.try({
		try: () => MoveBoardItemInputSchema.parse(props),
		catch: toGameActionError,
	});

	yield* tryGameAction(() =>
		db.transaction().execute((tx) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const { save, boardRows } = yield* readMutableSaveFx({
						tx,
					});
					assertInsideBoard(save, input.x, input.y);

					const boardItem = boardRows.find((row) => row.id === input.boardItemId);
					if (!boardItem)
						return yield* Effect.fail(
							new GameActionError("Board item does not exist."),
						);
					const occupied = boardRows.find(
						(row) => row.x === input.x && row.y === input.y && row.id !== boardItem.id,
					);
					if (occupied) {
						return yield* Effect.fail(
							new GameActionError(
								"Drop on an empty board cell or merge a valid recipe.",
							),
						);
					}

					yield* tryGameAction(() =>
						tx
							.updateTable(table.boardItem)
							.set({
								x: input.x,
								y: input.y,
								updatedAt: localTimestamp(),
							})
							.where("id", "=", boardItem.id)
							.execute(),
					);
				}),
			),
		),
	);
});
