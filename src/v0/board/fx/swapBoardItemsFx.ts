import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { SwapBoardItemsInputSchema } from "~/v0/board/schema/SwapBoardItemsInputSchema";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { toGameActionError } from "~/v0/play/fx/toGameActionError";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";

export namespace swapBoardItemsFx {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const swapBoardItemsFx = Effect.fn("swapBoardItemsFx")(function* (
	props: swapBoardItemsFx.Props,
) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const input = yield* Effect.tryPromise({
		try: () => SwapBoardItemsInputSchema.parseAsync(props),
		catch: toGameActionError,
	});
	if (input.sourceBoardItemId === input.targetBoardItemId) {
		return {
			visualEvents: [],
		} satisfies ActionResultSchema.Type;
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
					.updateTable("itemInstance")
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
					.updateTable("itemInstance")
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
					.updateTable("itemInstance")
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
			} satisfies ActionResultSchema.Type;
		}),
	);
});
