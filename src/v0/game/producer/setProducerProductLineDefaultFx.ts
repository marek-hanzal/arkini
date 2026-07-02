import { Effect } from "effect";
import { checkProducerProductLineSetDefaultReadinessFx } from "~/v0/game/producer/checkProducerProductLineSetDefaultReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readProducerDefaultEffectProductId } from "~/v0/game/producer/readProducerDefaultEffectProductId";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import { readProducerLineKind } from "~/v0/game/producer/readProducerLineKind";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import {
	readProducerProductLineDefinition,
	readProducerProductLineIds,
} from "~/v0/game/config/GameItemCapabilities";
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

const readNextProducerLineState = ({
	lineKind,
	nextProductId,
	previousState,
}: {
	lineKind: "effect" | "product";
	nextProductId: string | undefined;
	previousState: GameSave["producerLines"][string] | undefined;
}): GameSave["producerLines"][string] | undefined => {
	const nextState = {
		...(previousState ?? {}),
		...(lineKind === "effect"
			? {
					defaultEffectProductId: nextProductId,
				}
			: {
					defaultProductId: nextProductId,
				}),
	};

	if (!nextState.defaultProductId && !nextState.defaultEffectProductId) return undefined;
	return nextState;
};

export const setProducerProductLineDefaultFx = Effect.fn("setProducerProductLineDefaultFx")(
	function* ({ config, save, action, nowMs }: setProducerProductLineDefaultFx.Props) {
		const checked = yield* checkProducerProductLineSetDefaultReadinessFx({
			action,
			config,
			nowMs,
			save,
		});
		const product = readProducerProductLineDefinition({
			producerDefinition: checked.producerDefinition,
			productId: action.productId,
		});
		if (!product) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Missing producer line "${action.productId}".`,
				),
			);
		}

		const lineKind = readProducerLineKind({
			product,
		});
		const previousProductId =
			lineKind === "effect"
				? readProducerDefaultEffectProductId({
						productIds: readProducerProductLineIds({
							producerDefinition: checked.producerDefinition,
						}),
						producerItemInstanceId: action.producerItemInstanceId,
						save,
					})
				: readProducerDefaultProductId({
						productIds: readProducerProductLineIds({
							producerDefinition: checked.producerDefinition,
						}),
						producerItemInstanceId: action.producerItemInstanceId,
						save,
					});
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		const nextProductId = previousProductId === action.productId ? undefined : action.productId;
		const nextLineState = readNextProducerLineState({
			lineKind,
			nextProductId,
			previousState: nextSave.producerLines[action.producerItemInstanceId],
		});

		if (nextLineState) {
			nextSave.producerLines[action.producerItemInstanceId] = nextLineState;
		} else {
			delete nextSave.producerLines[action.producerItemInstanceId];
		}
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				{
					atMs: nowMs,
					nextProductId,
					previousProductId,
					producerItemInstanceId: action.producerItemInstanceId,
					type: "producer.product_line.default_changed" as const,
				},
			],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				config,
				nowMs,
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	},
);
