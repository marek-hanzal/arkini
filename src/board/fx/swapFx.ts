import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { SwapBoardItemsInputSchema } from "~/play/schema/SwapBoardItemsInputSchema";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameActionError } from "~/command/GameActionError";
import { toGameActionError } from "~/play/logic/toGameActionError";
import type { CommandResultSchema } from "~/command/CommandResultSchema";

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
	if (input.sourceBoardItemId === input.targetBoardItemId) {
		return {
			visualEvents: [],
		} satisfies CommandResultSchema.Type;
	}

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const { boardRows } = yield* readMutableSaveFx();
			const source = boardRows.find((row) => row.id === input.sourceBoardItemId);
			const target = boardRows.find((row) => row.id === input.targetBoardItemId);
			if (!source || !target) {
				return yield* Effect.fail(new GameActionError("Both board items must exist."));
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.itemInstance)
					.set({
						boardX: -1,
						boardY: -1,
						updatedAt: timestamp,
					})
					.where("id", "=", source.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable(table.itemInstance)
					.set({
						boardX: source.x,
						boardY: source.y,
						updatedAt: timestamp,
					})
					.where("id", "=", target.id)
					.execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable(table.itemInstance)
					.set({
						boardX: target.x,
						boardY: target.y,
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
							kind: "board",
							x: source.x,
							y: source.y,
						},
						sourceTo: {
							kind: "board",
							x: target.x,
							y: target.y,
						},
						targetItemInstanceId: target.id,
						targetItemId: target.itemDefinitionId,
						targetFrom: {
							kind: "board",
							x: target.x,
							y: target.y,
						},
						targetTo: {
							kind: "board",
							x: source.x,
							y: source.y,
						},
					},
				],
			} satisfies CommandResultSchema.Type;
		}),
	);
});
