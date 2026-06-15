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
import { readActivationInputRowsFx } from "~/activation/fx/readActivationInputRowsFx";
import { groupActivationInputRows } from "~/activation/logic/groupActivationInputRows";
import { storeActivationInputFx } from "~/activation/fx/storeActivationInputFx";
import type { CommandResultSchema } from "~/command/CommandResultSchema";

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

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const { boardRows } = yield* readMutableSaveFx();
			const source = boardRows.find((row) => row.id === input.sourceBoardItemId);
			const target = boardRows.find((row) => row.id === input.targetBoardItemId);
			if (!source || !target) {
				return yield* Effect.fail(new GameActionError("Both board items must exist."));
			}
			const activationInputRows = yield* readActivationInputRowsFx({
				ownerItemInstanceIds: [
					source.id,
					target.id,
				],
			});
			const activationInputsByOwner = groupActivationInputRows(activationInputRows);
			const sourceStoredInputs = activationInputsByOwner.get(source.id);
			const targetStoredInputs = activationInputsByOwner.get(target.id);
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
				if (sourceStoredInputs || targetStoredInputs) {
					return yield* Effect.fail(
						new GameActionError("Items with stored inputs cannot be merged."),
					);
				}
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
				return {
					visualEvents: [
						{
							type: "item.merged",
							sourceItemInstanceId: source.id,
							sourceItemId: source.itemDefinitionId,
							targetItemInstanceId: target.id,
							targetItemId: target.itemDefinitionId,
							resultItemId: mergeRule.resultItemId,
							consumeSource: mergeRule.consumeSource !== false,
						},
					],
				} satisfies CommandResultSchema.Type;
			}

			const craft = gameConfig.getCraftRecipeForTarget(target.itemDefinitionId);
			const craftInput = craft?.inputs.find(
				(entry) => entry.itemId === source.itemDefinitionId,
			);
			if (craft && craftInput) {
				if (sourceStoredInputs) {
					return yield* Effect.fail(
						new GameActionError("Item with stored inputs cannot be used as input."),
					);
				}
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
				return {
					visualEvents: [
						{
							type: "item.consumed",
							itemInstanceId: source.id,
							itemId: source.itemDefinitionId,
							from: {
								kind: "board",
								x: source.x,
								y: source.y,
							},
							reason: "craft-input",
						},
					],
				} satisfies CommandResultSchema.Type;
			}

			const targetActivation = gameConfig.getActivation(target.itemDefinitionId);
			const activationInput = targetActivation?.inputs?.find(
				(entry) => entry.itemId === source.itemDefinitionId,
			);
			if (targetActivation && activationInput) {
				if (sourceStoredInputs) {
					return yield* Effect.fail(
						new GameActionError("Item with stored inputs cannot be used as input."),
					);
				}
				if (!isEmptyInventoryState(sourceState)) {
					return yield* Effect.fail(
						new GameActionError("Stateful item cannot be used as input."),
					);
				}
				const stored = targetStoredInputs?.get(source.itemDefinitionId) ?? 0;
				if (stored >= activationInput.capacity) {
					return yield* Effect.fail(new GameActionError("Input storage is full."));
				}

				yield* storeActivationInputFx({
					sourceItemInstanceId: source.id,
					ownerItemInstanceId: target.id,
					itemId: source.itemDefinitionId,
				});
				return {
					visualEvents: [
						{
							type: "item.fed",
							sourceItemInstanceId: source.id,
							targetItemInstanceId: target.id,
							itemId: source.itemDefinitionId,
						},
					],
				} satisfies CommandResultSchema.Type;
			}

			return yield* Effect.fail(
				new GameActionError("No merge or craft recipe discovered here."),
			);
		}),
	);
});
