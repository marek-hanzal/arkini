import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/boardState";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import type { ItemId } from "~/manifest/data/manifestId";
import { resolveItemMergeRule } from "~/manifest/data/resolveItemMergeRule";
import { MergeBoardItemsInputSchema } from "~/play/logic/gameActionSchemas";
import { readMutableSaveFx } from "~/play/logic/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/fx/toGameActionError";
import { tryGameActionFx } from "~/play/logic/fx/tryGameActionFx";
import { localTimestamp } from "~/play/logic/localTimestamp";
import { GameActionError } from "~/play/logic/playTypes";
import { json } from "~/shared/json";

export namespace mergeFx {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const mergeFx = Effect.fn("mergeFx")(function* (props: mergeFx.Props) {
	const input = yield* Effect.try({
		try: () => MergeBoardItemsInputSchema.parse(props),
		catch: toGameActionError,
	});
	if (input.sourceBoardItemId === input.targetBoardItemId) {
		return yield* Effect.fail(new GameActionError("Pick two different board items to merge."));
	}

	yield* tryGameActionFx(() =>
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

					const rule = resolveItemMergeRule(
						source.itemDefinitionId as ItemId,
						target.itemDefinitionId as ItemId,
					);
					if (!rule)
						return yield* Effect.fail(
							new GameActionError("No merge recipe discovered here."),
						);

					yield* tryGameActionFx(() =>
						tx.deleteFrom(table.boardItem).where("id", "=", source.id).execute(),
					);
					yield* tryGameActionFx(() =>
						tx
							.updateTable(table.boardItem)
							.set({
								itemDefinitionId: rule.resultItemId,
								stateJson: json(createInitialBoardState(rule.resultItemId)),
								updatedAt: localTimestamp(),
							})
							.where("id", "=", target.id)
							.execute(),
					);
				}),
			),
		),
	);
});
