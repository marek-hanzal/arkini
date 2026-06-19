import { Effect } from "effect";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
import { readProducerBoardItemFx } from "~/v0/game/producer/readProducerBoardItemFx";
import { readProducerProductIdsByPriority } from "~/v0/game/producer/readProducerProductIdsByPriority";
import { readProducerProductLineEnabledFx } from "~/v0/game/producer/readProducerProductLineEnabledFx";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerInputStore } from "~/v0/game/action/GameActionProducerInputStore";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkProducerInputStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputStore;
	}
}

export const checkProducerInputStoreReadinessFx = Effect.fn("checkProducerInputStoreReadinessFx")(
	function* ({ config, save, action }: checkProducerInputStoreReadinessFx.Props) {
		const producerItem = yield* readProducerBoardItemFx({
			config,
			producerItemInstanceId: action.producerItemInstanceId,
			save,
		});
		const producerId = config.items[producerItem.itemId]?.producerId ?? "";
		const producerDefinition = config.producers[producerId];
		if (!producerDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Producer item "${producerItem.itemId}" references missing producer.`,
				),
			);
		}

		const resolvedRefs = yield* resolveInputRefsFx({
			inputRefs: [
				action.inputRef,
			],
			save,
		});
		const resolvedRef = resolvedRefs[0];
		if (!resolvedRef) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("input_unavailable", "Missing producer input."),
			);
		}
		if (
			resolvedRef.kind === "board" &&
			resolvedRef.itemInstanceId === action.producerItemInstanceId
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"invalid_actor",
					"Producer input target cannot store itself.",
				),
			);
		}

		const productIds = action.productId
			? [
					action.productId,
				]
			: readProducerProductIdsByPriority({
					productIds: producerDefinition.productIds,
					producerItemInstanceId: action.producerItemInstanceId,
					save,
				});

		for (const productId of productIds) {
			if (!producerDefinition.productIds.includes(productId)) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"invalid_actor",
						`Product "${productId}" does not belong to producer "${producerId}".`,
					),
				);
			}

			const enabled = yield* readProducerProductLineEnabledFx({
				producerItemInstanceId: action.producerItemInstanceId,
				productId,
				save,
			});
			if (!enabled) {
				continue;
			}

			const inputSlot = readProductInputs({
				config,
				productId,
			}).find((input) => input.itemId === resolvedRef.itemId);
			if (!inputSlot) {
				continue;
			}

			const storedInputs = yield* readProducerProductStoredInputQuantitiesFx({
				producerItemInstanceId: action.producerItemInstanceId,
				productId,
				save,
			});
			const previousQuantity = storedInputs.get(resolvedRef.itemId) ?? 0;
			const nextQuantity = previousQuantity + resolvedRef.quantity;
			if (nextQuantity > inputSlot.capacity) {
				continue;
			}

			return {
				inputSlot,
				nextQuantity,
				previousQuantity,
				producerDefinition,
				producerItem,
				productId,
				resolvedRef,
			};
		}

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				`Producer input "${resolvedRef.itemId}" is not accepted by any enabled product line with capacity.`,
			),
		);
	},
);
