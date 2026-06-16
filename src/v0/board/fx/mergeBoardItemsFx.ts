import { Effect } from "effect";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import { readActivationInputRowsFx } from "~/v0/activation/fx/readActivationInputRowsFx";
import { storeActivationInputFx } from "~/v0/activation/fx/storeActivationInputFx";
import { groupActivationInputRows } from "~/v0/activation/logic/groupActivationInputRows";
import { createInitialBoardState } from "~/v0/board/logic/createInitialBoardState";
import { readStoredBoardState } from "~/v0/board/logic/readStoredBoardState";
import { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { readCraftInputRowsFx } from "~/v0/craft/fx/readCraftInputRowsFx";
import { storeCraftInputFx } from "~/v0/craft/fx/storeCraftInputFx";
import { startCraftFx } from "~/v0/craft/fx/startCraftFx";
import { groupCraftInputRows } from "~/v0/craft/logic/groupCraftInputRows";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { isEmptyInventoryState } from "~/v0/inventory/logic/isEmptyInventoryState";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { MergeBoardItemsInputSchema } from "~/v0/board/schema/MergeBoardItemsInputSchema";
import { json } from "~/v0/serialization/json";
import { toGameActionError } from "~/v0/play/action/toGameActionError";

export namespace mergeBoardItemsFx {
	export interface Props {
		sourceBoardItemId: string;
		targetBoardItemId: string;
	}
}

export const mergeBoardItemsFx = Effect.fn("mergeBoardItemsFx")(function* (
	props: mergeBoardItemsFx.Props,
) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const now = date.now();
	const timestamp = date.toTimestamp(now);

	const input = yield* Effect.tryPromise({
		try: () => MergeBoardItemsInputSchema.parseAsync(props),
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

			const [activationInputRows, craftInputRows] = yield* Effect.all([
				readActivationInputRowsFx({
					ownerItemInstanceIds: [
						source.id,
						target.id,
					],
				}),
				readCraftInputRowsFx({
					ownerItemInstanceIds: [
						source.id,
						target.id,
					],
				}),
			]);
			const activationInputsByOwner = groupActivationInputRows(activationInputRows);
			const craftInputsByOwner = groupCraftInputRows(craftInputRows);
			const sourceHasNestedStorage =
				activationInputsByOwner.has(source.id) || craftInputsByOwner.has(source.id);
			const targetHasNestedStorage =
				activationInputsByOwner.has(target.id) || craftInputsByOwner.has(target.id);
			const targetActivationStoredInputs = activationInputsByOwner.get(target.id);
			const targetCraftStoredInputs =
				craftInputsByOwner.get(target.id) ?? new Map<ItemId, number>();

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
				if (sourceHasNestedStorage || targetHasNestedStorage) {
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
						db.deleteFrom("itemInstance").where("id", "=", source.id).execute(),
					);
				}
				yield* dbFx((db) =>
					db
						.updateTable("itemInstance")
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
							animation: ActionVisualAnimation.parallelMove({
								cause: "merge",
								groupId: `merge:${source.id}:${target.id}`,
							}),
							sourceItemInstanceId: source.id,
							sourceItemId: source.itemDefinitionId,
							targetItemInstanceId: target.id,
							targetItemId: target.itemDefinitionId,
							resultItemId: mergeRule.resultItemId,
							consumeSource: mergeRule.consumeSource !== false,
						},
					],
				} satisfies ActionResultSchema.Type;
			}

			const craft = gameConfig.getCraftRecipeForTarget(target.itemDefinitionId);
			const craftInput = craft?.inputs.find(
				(entry) => entry.itemId === source.itemDefinitionId,
			);
			if (craft && craftInput) {
				if (sourceHasNestedStorage) {
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
				const alreadyDelivered = targetCraftStoredInputs.get(source.itemDefinitionId) ?? 0;
				if (alreadyDelivered >= craftInput.quantity) {
					return yield* Effect.fail(
						new GameActionError("This craft input is already complete."),
					);
				}

				const delivered = new Map(targetCraftStoredInputs);
				delivered.set(source.itemDefinitionId, alreadyDelivered + 1);
				const complete = craft.inputs.every(
					(entry) => (delivered.get(entry.itemId) ?? 0) >= entry.quantity,
				);

				yield* storeCraftInputFx({
					sourceItemInstanceId: source.id,
					ownerItemInstanceId: target.id,
					itemId: source.itemDefinitionId,
				});

				const craftEvents = complete
					? yield* startCraftFx({
							boardItemId: target.id,
							itemId: target.itemDefinitionId,
							state: targetState,
							storedInputs: delivered,
						})
					: [];

				return {
					visualEvents: [
						{
							type: "item.consumed",
							animation: ActionVisualAnimation.parallelMove({
								cause: "craft",
								groupId: `craft-input:${source.id}:${target.id}`,
							}),
							itemInstanceId: source.id,
							itemId: source.itemDefinitionId,
							from: {
								kind: "board",
								x: source.x,
								y: source.y,
							},
							reason: "craft-input",
						},
						...craftEvents,
					],
				} satisfies ActionResultSchema.Type;
			}

			const targetActivation = gameConfig.getActivation(target.itemDefinitionId);
			const activationInput = targetActivation?.inputs?.find(
				(entry) => entry.itemId === source.itemDefinitionId,
			);
			const activationRequirement = targetActivation?.requirements?.find(
				(entry) => entry.itemId === source.itemDefinitionId,
			);
			const activationDeposit = activationInput ?? activationRequirement;
			if (targetActivation && activationDeposit) {
				if (sourceHasNestedStorage) {
					return yield* Effect.fail(
						new GameActionError("Item with stored inputs cannot be used as input."),
					);
				}
				if (!isEmptyInventoryState(sourceState)) {
					return yield* Effect.fail(
						new GameActionError("Stateful item cannot be used as input."),
					);
				}
				const stored = targetActivationStoredInputs?.get(source.itemDefinitionId) ?? 0;
				if (stored >= activationDeposit.capacity) {
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
							animation: ActionVisualAnimation.parallelMove({
								cause: "activation",
								groupId: `activation-input:${source.id}:${target.id}`,
							}),
							sourceItemInstanceId: source.id,
							targetItemInstanceId: target.id,
							itemId: source.itemDefinitionId,
						},
					],
				} satisfies ActionResultSchema.Type;
			}

			return yield* Effect.fail(
				new GameActionError("No merge or craft recipe discovered here."),
			);
		}),
	);
});
