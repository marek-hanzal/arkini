import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import { readProducerProductIdsByPriority } from "~/v0/game/producer/readProducerProductIdsByPriority";
import { readVisibleProducerProductIds } from "~/v0/game/producer/readVisibleProducerProductIds";
import { readProducerProductStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerProductStoredInputQuantitiesFx";
import { resolveInputRefsFx } from "~/v0/game/activation/resolveInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerProductLineDefinition,
	readProducerProductLineIds,
} from "~/v0/game/config/GameItemCapabilities";
import type { GameActionProducerInputStore } from "~/v0/game/action/GameActionProducerInputStore";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace checkProducerInputStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionProducerInputStore;
	}
}

export const checkProducerInputStoreReadinessFx = Effect.fn("checkProducerInputStoreReadinessFx")(
	function* ({ config, nowMs, save, action }: checkProducerInputStoreReadinessFx.Props) {
		const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx(
			{
				config,
				producerItemInstanceId: action.producerItemInstanceId,
				save,
			},
		);

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

		const visibleProductIds = readVisibleProducerProductIds({
			config,
			producerItemInstanceId: action.producerItemInstanceId,
			nowMs,
			productIds: readProducerProductLineIds({
				producerDefinition,
			}),
			save,
		});
		const productIds = action.productId
			? [
					action.productId,
				]
			: readProducerProductIdsByPriority({
					productIds: visibleProductIds,
					producerItemInstanceId: action.producerItemInstanceId,
					save,
				});

		for (const productId of productIds) {
			if (
				!readProducerProductLineIds({
					producerDefinition,
				}).includes(productId)
			) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"invalid_actor",
						`Product "${productId}" does not belong to producer "${producerId}".`,
					),
				);
			}
			if (!visibleProductIds.includes(productId)) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"invalid_actor",
						`Product "${productId}" is hidden for the current game state.`,
					),
				);
			}

			const inputSlot = readProducerProductLineDefinition({
				producerDefinition,
				productId,
			})?.inputs?.find((input) => input.itemId === resolvedRef.itemId);
			if (!inputSlot) {
				continue;
			}

			const storedInputs = yield* readProducerProductStoredInputQuantitiesFx({
				producerItemInstanceId: action.producerItemInstanceId,
				productId,
				save,
			});
			const previousQuantity = readGameItemQuantity({
				itemId: resolvedRef.itemId,
				quantities: storedInputs,
			});
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
				`Producer input "${resolvedRef.itemId}" is not accepted by any product line with capacity.`,
			),
		);
	},
);
