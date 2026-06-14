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
import { json, parseJson } from "~/shared/json";

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

			const targetProducer = gameConfig.getProducer(target.itemDefinitionId);
			const producerInput = targetProducer?.inputs?.find(
				(input) => input.itemId === source.itemDefinitionId,
			);

			if (targetProducer && producerInput) {
				const targetState = {
					...createInitialBoardState(target.itemDefinitionId, gameConfig),
					...readStoredBoardState(target.stateJson),
				};
				const producerState = targetState.producer ?? {};
				const inventory = {
					...(producerState.inventory ?? {}),
				};
				const stored = inventory[source.itemDefinitionId] ?? 0;
				if (stored >= producerInput.capacity) {
					return yield* Effect.fail(
						new GameActionError("Producer input storage is full."),
					);
				}
				inventory[source.itemDefinitionId] = stored + 1;

				yield* dbFx((db) =>
					db.deleteFrom(table.boardItem).where("id", "=", source.id).execute(),
				);
				yield* dbFx((db) =>
					db
						.updateTable(table.boardItem)
						.set({
							stateJson: json({
								...targetState,
								producer: {
									...producerState,
									inventory,
								},
							}),
							updatedAt: timestamp,
						})
						.where("id", "=", target.id)
						.execute(),
				);
				return;
			}

			const craft = gameConfig.getCraftRecipeForTarget(target.itemDefinitionId);
			const craftInput = craft?.inputs.find(
				(input) => input.itemId === source.itemDefinitionId,
			);

			if (craft && craftInput) {
				const targetState = {
					...createInitialBoardState(target.itemDefinitionId, gameConfig),
					...readStoredBoardState(target.stateJson),
				};
				const delivered = {
					...(targetState.craft?.delivered ?? {}),
				};
				const alreadyDelivered = delivered[source.itemDefinitionId] ?? 0;
				if (alreadyDelivered >= craftInput.quantity) {
					return yield* Effect.fail(
						new GameActionError("This craft input is already complete."),
					);
				}
				delivered[source.itemDefinitionId] = alreadyDelivered + 1;
				const complete = craft.inputs.every(
					(input) => (delivered[input.itemId] ?? 0) >= input.quantity,
				);

				yield* dbFx((db) =>
					db.deleteFrom(table.boardItem).where("id", "=", source.id).execute(),
				);
				yield* dbFx((db) =>
					db
						.updateTable(table.boardItem)
						.set({
							itemDefinitionId: complete
								? craft.resultItemId
								: target.itemDefinitionId,
							stateJson: json(
								complete
									? createInitialBoardState(craft.resultItemId, gameConfig)
									: {
											...targetState,
											craft: {
												delivered,
											},
										},
							),
							updatedAt: timestamp,
						})
						.where("id", "=", target.id)
						.execute(),
				);
				return;
			}

			const rule = gameConfig.resolveMergeRule(
				source.itemDefinitionId,
				target.itemDefinitionId,
			);
			if (!rule) {
				return yield* Effect.fail(
					new GameActionError("No merge or craft recipe discovered here."),
				);
			}

			if (
				rule.consumeSource === false &&
				(source.itemDefinitionId !== rule.sourceItemId ||
					target.itemDefinitionId !== rule.withItemId)
			) {
				return yield* Effect.fail(
					new GameActionError("This merge must be applied in the defined direction."),
				);
			}

			if (rule.consumeSource !== false) {
				yield* dbFx((db) =>
					db.deleteFrom(table.boardItem).where("id", "=", source.id).execute(),
				);
			}
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

function readStoredBoardState(stateJson: string) {
	return parseJson<ReturnType<typeof createInitialBoardState>>(stateJson || "{}");
}
