import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/boardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { MergeBoardItemsInputSchema } from "~/play/logic/gameActionSchemas";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { json } from "~/shared/json";

export namespace mergeFx {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const mergeFx = Effect.fn("mergeFx")(function* (props: mergeFx.Props) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const timestamp = date.timestamp();

	const input = yield* Effect.try({
		try: () => MergeBoardItemsInputSchema.parse(props),
		catch: toGameActionError,
	});
	if (input.sourceBoardItemId === input.targetBoardItemId) {
		return yield* Effect.fail(new GameActionError("Pick two different board items to merge."));
	}

	yield* withTransactionFx(
		Effect.gen(function* () {
			const { boardRows } = yield* readMutableSaveFx();
			const source = boardRows.find((row) => row.id === input.sourceBoardItemId);
			const target = boardRows.find((row) => row.id === input.targetBoardItemId);
			if (!source || !target) {
				return yield* Effect.fail(new GameActionError("Both board items must exist."));
			}

			const rule = gameConfig.resolveMergeRule(
				source.itemDefinitionId,
				target.itemDefinitionId,
			);
			if (!rule) {
				return yield* Effect.fail(new GameActionError("No merge recipe discovered here."));
			}

			yield* dbFx((db) =>
				db.deleteFrom(table.boardItem).where("id", "=", source.id).execute(),
			);
			yield* dbFx((db) =>
				db
					.updateTable(table.boardItem)
					.set({
						itemDefinitionId: rule.resultItemId,
						stateJson: json(createInitialBoardState(rule.resultItemId, gameConfig)),
						updatedAt: timestamp,
					})
					.where("id", "=", target.id)
					.execute(),
			);
		}),
	);
});
