import { Effect } from "effect";
import { checkProducerProductLineSetDefaultReadinessFx } from "~/v0/game/producer/checkProducerProductLineSetDefaultReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductLineSetDefault } from "~/v0/game/action/GameActionProducerProductLineSetDefault";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace setProducerProductLineDefaultFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerProductLineSetDefault;
		nowMs: number;
	}
}

export const setProducerProductLineDefaultFx = Effect.fn("setProducerProductLineDefaultFx")(
	function* ({ config, save, action, nowMs }: setProducerProductLineDefaultFx.Props) {
		const checked = yield* checkProducerProductLineSetDefaultReadinessFx({
			action,
			config,
			save,
		});
		const previousProductId = readProducerDefaultProductId({
			productIds: checked.producerDefinition.productIds,
			producerItemInstanceId: action.producerItemInstanceId,
			save,
		});
		if (previousProductId === action.productId) {
			return {
				events: [],
				nextWakeAtMs: yield* readNextWakeAtMsFx({
					save,
				}),
				save,
			} satisfies GameEngineResult;
		}

		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		const previousState = nextSave.producerLines[action.producerItemInstanceId];
		const nextDefaultProductId =
			action.productId === checked.producerDefinition.productIds[0]
				? undefined
				: action.productId;
		const nextDisabledProductIds = previousState?.disabledProductIds ?? [];
		if (nextDisabledProductIds.length === 0 && !nextDefaultProductId) {
			delete nextSave.producerLines[action.producerItemInstanceId];
		} else {
			nextSave.producerLines[action.producerItemInstanceId] = {
				disabledProductIds: nextDisabledProductIds,
				...(nextDefaultProductId
					? {
							defaultProductId: nextDefaultProductId,
						}
					: {}),
			};
		}
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					changedAtMs: nowMs,
					nextProductId: action.productId,
					previousProductId,
					producerItemInstanceId: action.producerItemInstanceId,
					type: "producer.product_line.default_changed" as const,
				},
			],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	},
);
