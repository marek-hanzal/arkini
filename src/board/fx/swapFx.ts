import { Effect } from "effect";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { SwapBoardItemsInputSchema } from "~/play/logic/gameActionSchemas";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { tryGameAction } from "~/play/logic/tryGameAction";
import { localTimestamp } from "~/play/logic/localTimestamp";
import { GameActionError } from "~/play/logic/playTypes";

export namespace swapFx {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const swapFx = Effect.fn("swapFx")(function* (props: swapFx.Props) {
	const input = yield* Effect.try({
		try: () => SwapBoardItemsInputSchema.parse(props),
		catch: toGameActionError,
	});
	if (input.sourceBoardItemId === input.targetBoardItemId) return;

	yield* tryGameAction(() =>
		db.transaction().execute((tx) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const { boardRows } = yield* readMutableSaveFx({
						tx,
					});
					const source = boardRows.find((row) => row.id === input.sourceBoardItemId);
					const target = boardRows.find((row) => row.id === input.targetBoardItemId);
					if (!source || !target) {
						return yield* Effect.fail(
							new GameActionError("Both board items must exist."),
						);
					}

					yield* tryGameAction(() =>
						tx
							.updateTable(table.boardItem)
							.set({
								x: -1,
								y: -1,
								updatedAt: localTimestamp(),
							})
							.where("id", "=", source.id)
							.execute(),
					);
					yield* tryGameAction(() =>
						tx
							.updateTable(table.boardItem)
							.set({
								x: source.x,
								y: source.y,
								updatedAt: localTimestamp(),
							})
							.where("id", "=", target.id)
							.execute(),
					);
					yield* tryGameAction(() =>
						tx
							.updateTable(table.boardItem)
							.set({
								x: target.x,
								y: target.y,
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
