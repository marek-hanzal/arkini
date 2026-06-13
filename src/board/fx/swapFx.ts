import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { SwapBoardItemsInputSchema } from "~/play/logic/gameActionSchemas";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";

export namespace swapFx {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const swapFx = Effect.fn("swapFx")(function* (props: swapFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const input = yield* Effect.try({
		try: () => SwapBoardItemsInputSchema.parse(props),
		catch: toGameActionError,
	});
	if (input.sourceBoardItemId === input.targetBoardItemId) return;

	yield* withTransactionFx(
		Effect.gen(function* () {
			const { boardRows } = yield* readMutableSaveFx();
			const source = boardRows.find((row) => row.id === input.sourceBoardItemId);
			const target = boardRows.find((row) => row.id === input.targetBoardItemId);
			if (!source || !target) {
				return yield* Effect.fail(new GameActionError("Both board items must exist."));
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.boardItem)
					.set({
						x: -1,
						y: -1,
						updatedAt: timestamp,
					})
					.where("id", "=", source.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable(table.boardItem)
					.set({
						x: source.x,
						y: source.y,
						updatedAt: timestamp,
					})
					.where("id", "=", target.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable(table.boardItem)
					.set({
						x: target.x,
						y: target.y,
						updatedAt: timestamp,
					})
					.where("id", "=", source.id)
					.execute(),
			);
		}),
	);
});
