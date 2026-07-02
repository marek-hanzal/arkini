import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/v0/game/producer/readProducerRuntimeTargetFx";
import { readProducerLineIdsByPriority } from "~/v0/game/producer/readProducerLineIdsByPriority";
import { readVisibleProducerLineIds } from "~/v0/game/producer/readVisibleProducerLineIds";
import { readProducerLineStoredInputQuantitiesFx } from "~/v0/game/producer/readProducerLineStoredInputQuantitiesFx";
import { resolveInputRefsFx } from "~/v0/game/activation/resolveInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerLineDefinition,
	readProducerLineIds,
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

		const visibleLineIds = readVisibleProducerLineIds({
			config,
			producerDefinition,
			producerItemInstanceId: action.producerItemInstanceId,
			nowMs,
			lineIds: readProducerLineIds({
				producerDefinition,
			}),
			save,
		});
		const lineIds = action.lineId
			? [
					action.lineId,
				]
			: readProducerLineIdsByPriority({
					lineIds: visibleLineIds,
					producerItemInstanceId: action.producerItemInstanceId,
					save,
				});

		for (const lineId of lineIds) {
			if (
				!readProducerLineIds({
					producerDefinition,
				}).includes(lineId)
			) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"invalid_actor",
						`Line "${lineId}" does not belong to producer "${producerId}".`,
					),
				);
			}
			if (!visibleLineIds.includes(lineId)) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"invalid_actor",
						`Line "${lineId}" is hidden for the current game state.`,
					),
				);
			}

			const inputSlot = readProducerLineDefinition({
				producerDefinition,
				lineId,
			})?.inputs?.find((input) => input.itemId === resolvedRef.itemId);
			if (!inputSlot) {
				continue;
			}

			const storedInputs = yield* readProducerLineStoredInputQuantitiesFx({
				producerItemInstanceId: action.producerItemInstanceId,
				lineId,
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
				lineId,
				resolvedRef,
			};
		}

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				`Producer input "${resolvedRef.itemId}" is not accepted by any producer line with capacity.`,
			),
		);
	},
);
