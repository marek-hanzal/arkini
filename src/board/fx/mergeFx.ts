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

			const mergeRule = gameConfig.resolveMergeRule(
				source.itemDefinitionId,
				target.itemDefinitionId,
			);
			if (mergeRule) {
				if (
					mergeRule.consumeSource === false &&
					(source.itemDefinitionId !== mergeRule.sourceItemId ||
						target.itemDefinitionId !== mergeRule.withItemId)
				) {
					return yield* Effect.fail(
						new GameActionError("This merge must be applied in the defined direction."),
					);
				}

				if (mergeRule.consumeSource !== false) {
					yield* dbFx((db) =>
						db.deleteFrom(table.boardItem).where("id", "=", source.id).execute(),
					);
				}
				yield* dbFx((db) =>
					db
						.updateTable(table.boardItem)
						.set({
							itemDefinitionId: mergeRule.resultItemId,
							stateJson: json(
								createInitialBoardState(mergeRule.resultItemId, gameConfig),
							),
							updatedAt: timestamp,
						})
						.where("id", "=", target.id)
						.execute(),
				);
				return;
			}

			const craft = gameConfig.getCraftRecipeForTarget(target.itemDefinitionId);
			const craftInput = craft?.inputs.find(
				(entry) => entry.itemId === source.itemDefinitionId,
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
					(entry) => (delivered[entry.itemId] ?? 0) >= entry.quantity,
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

			const targetActivation = gameConfig.getActivation(target.itemDefinitionId);
			const activationInput = targetActivation?.inputs?.find(
				(entry) => entry.itemId === source.itemDefinitionId,
			);
			if (targetActivation && activationInput) {
				const targetState = {
					...createInitialBoardState(target.itemDefinitionId, gameConfig),
					...readStoredBoardState(target.stateJson),
				};
				const activationState = targetState.activation ?? {};
				const inventory = {
					...(activationState.inventory ?? {}),
				};
				const stored = inventory[source.itemDefinitionId] ?? 0;
				if (stored >= activationInput.capacity) {
					return yield* Effect.fail(new GameActionError("Input storage is full."));
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
								activation: {
									...activationState,
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

			return yield* Effect.fail(
				new GameActionError("No merge or craft recipe discovered here."),
			);
		}),
	);
});

function readStoredBoardState(stateJson: string) {
	return parseJson<ReturnType<typeof createInitialBoardState>>(stateJson || "{}");
}
