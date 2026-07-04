import { Effect } from "effect";
import { readProducerRuntimeTargetFx } from "~/producer/readProducerRuntimeTargetFx";
import { readLineIdsByPriority } from "~/producer/readLineIdsByPriority";
import { readVisibleLineIds } from "~/producer/readVisibleLineIds";
import { readLineStoredInputQuantitiesFx } from "~/producer/readLineStoredInputQuantitiesFx";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readLineDefinition, readLineIds } from "~/config/GameItemCapabilities";
import type { GameActionProducerInputStoreSchema } from "~/action/GameActionProducerInputStoreSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export namespace checkProducerInputStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionProducerInputStoreSchema.Type;
	}
}

export const checkProducerInputStoreReadinessFx = Effect.fn("checkProducerInputStoreReadinessFx")(
	function* ({ config, nowMs, save, action }: checkProducerInputStoreReadinessFx.Props) {
		const { producerDefinition, producerId, producerItem } = yield* readProducerRuntimeTargetFx(
			{
				config,
				itemInstanceId: action.itemInstanceId,
				save,
			},
		);

		const resolvedRef = yield* resolveSingleInputRefFx({
			inputRef: action.inputRef,
			missingMessage: "Missing producer input.",
			save,
		});
		yield* assertResolvedInputRefIsNotBoardItemFx({
			inputRef: resolvedRef,
			message: "Producer input target cannot store itself.",
			targetItemInstanceId: action.itemInstanceId,
		});

		const visibleLineIds = readVisibleLineIds({
			config,
			producerDefinition,
			itemInstanceId: action.itemInstanceId,
			nowMs,
			lineIds: readLineIds({
				producerDefinition,
			}),
			save,
		});
		const lineIds = action.lineId
			? [
					action.lineId,
				]
			: readLineIdsByPriority({
					lineIds: visibleLineIds,
					itemInstanceId: action.itemInstanceId,
					save,
				});

		for (const lineId of lineIds) {
			if (
				!readLineIds({
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

			const inputSlot = readLineDefinition({
				producerDefinition,
				lineId,
			})?.inputs?.find((input) => input.itemId === resolvedRef.itemId);
			if (!inputSlot) {
				continue;
			}

			const storedInputs = yield* readLineStoredInputQuantitiesFx({
				itemInstanceId: action.itemInstanceId,
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
				`Producer input "${resolvedRef.itemId}" is not accepted by any line with capacity.`,
			),
		);
	},
);
