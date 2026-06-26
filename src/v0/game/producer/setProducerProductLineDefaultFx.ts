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
			nowMs,
			save,
		});
		const previousProductId = readProducerDefaultProductId({
			productIds: checked.producerDefinition.productIds,
			producerItemInstanceId: action.producerItemInstanceId,
			save,
		});
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		const nextProductId = previousProductId === action.productId ? undefined : action.productId;

		if (nextProductId) {
			nextSave.producerLines[action.producerItemInstanceId] = {
				defaultProductId: nextProductId,
			};
		} else {
			delete nextSave.producerLines[action.producerItemInstanceId];
		}
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					changedAtMs: nowMs,
					nextProductId,
					previousProductId,
					producerItemInstanceId: action.producerItemInstanceId,
					type: "producer.product_line.default_changed" as const,
				},
			],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				nowMs,
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	},
);
