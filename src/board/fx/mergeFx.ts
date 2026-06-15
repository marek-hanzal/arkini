import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { isEmptyInventoryState } from "~/inventory/logic/isEmptyInventoryState";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { MergeBoardItemsInputSchema } from "~/play/schema/MergeBoardItemsInputSchema";
import { GameActionError } from "~/command/GameActionError";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { json } from "~/shared/json";
import { readStoredBoardState } from "~/board/logic/readStoredBoardState";

export namespace mergeFx {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const mergeFx = Effect.fn("mergeFx")(function* (props: mergeFx.Props) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const now = date.now();
	const timestamp = date.toTimestamp(now);

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
			const sourceState = readStoredBoardState(source.stateJson);
			if (sourceState.craft?.startedAt || sourceState.craft?.readyAt) {
				return yield* Effect.fail(new GameActionError("Craft is already in progress."));
			}
			const targetState = {
				...createInitialBoardState(target.itemDefinitionId, gameConfig),
				...readStoredBoardState(target.stateJson),
			};

			const mergeRule = gameConfig.resolveMergeRule(
				source.itemDefinitionId,
				target.itemDefinitionId,
			);
			if (mergeRule) {
				if (targetState.craft?.startedAt || targetState.craft?.readyAt) {
					return yield* Effect.fail(new GameActionError("Craft is already in progress."));
				}
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
						db.deleteFrom(table.itemInstance).where("id", "=", source.id).execute(),
					);
				}
				yield* dbFx((db) =>
					db
						.updateTable(table.itemInstance)
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
				if (!isEmptyInventoryState(sourceState)) {
					return yield* Effect.fail(
						new GameActionError("Stateful item cannot be used as input."),
					);
				}
				if (targetState.craft?.startedAt || targetState.craft?.readyAt) {
					return yield* Effect.fail(new GameActionError("Craft is already in progress."));
				}
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
					db.deleteFrom(table.itemInstance).where("id", "=", source.id).execute(),
				);
				yield* dbFx((db) =>
					db
						.updateTable(table.itemInstance)
						.set({
							itemDefinitionId:
								complete && craft.durationMs === 0
									? craft.resultItemId
									: target.itemDefinitionId,
							stateJson: json(
								complete
									? craft.durationMs === 0
										? createInitialBoardState(craft.resultItemId, gameConfig)
										: {
												...targetState,
												craft: {
													delivered,
													startedAt: timestamp,
													readyAt: date.toTimestamp(
														now.plus({
															milliseconds: craft.durationMs,
														}),
													),
												},
											}
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
				if (!isEmptyInventoryState(sourceState)) {
					return yield* Effect.fail(
						new GameActionError("Stateful item cannot be used as input."),
					);
				}
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
					db.deleteFrom(table.itemInstance).where("id", "=", source.id).execute(),
				);
				yield* dbFx((db) =>
					db
						.updateTable(table.itemInstance)
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
