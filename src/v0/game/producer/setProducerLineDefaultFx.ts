import { Effect } from "effect";
import { checkProducerLineSetDefaultReadinessFx } from "~/v0/game/producer/checkProducerLineSetDefaultReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readProducerDefaultEffectLineId } from "~/v0/game/producer/readProducerDefaultEffectLineId";
import { readProducerDefaultLineId } from "~/v0/game/producer/readProducerDefaultLineId";
import { readProducerLineKind } from "~/v0/game/producer/readProducerLineKind";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import {
	readProducerLineDefinition,
	readProducerLineIds,
} from "~/v0/game/config/GameItemCapabilities";
import type { GameActionProducerLineSetDefault } from "~/v0/game/action/GameActionProducerLineSetDefault";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace setProducerLineDefaultFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerLineSetDefault;
		nowMs: number;
	}
}

const readNextProducerLineState = ({
	lineKind,
	nextLineId,
	previousState,
}: {
	lineKind: "effect" | "product";
	nextLineId: string | undefined;
	previousState: GameSave["producerLines"][string] | undefined;
}): GameSave["producerLines"][string] | undefined => {
	const nextState = {
		...(previousState ?? {}),
		...(lineKind === "effect"
			? {
					defaultEffectLineId: nextLineId,
				}
			: {
					defaultLineId: nextLineId,
				}),
	};

	if (!nextState.defaultLineId && !nextState.defaultEffectLineId) return undefined;
	return nextState;
};

export const setProducerLineDefaultFx = Effect.fn("setProducerLineDefaultFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: setProducerLineDefaultFx.Props) {
	const checked = yield* checkProducerLineSetDefaultReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const line = readProducerLineDefinition({
		producerDefinition: checked.producerDefinition,
		lineId: action.lineId,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing producer line "${action.lineId}".`),
		);
	}

	const lineKind = readProducerLineKind({
		line,
	});
	const previousLineId =
		lineKind === "effect"
			? readProducerDefaultEffectLineId({
					lineIds: readProducerLineIds({
						producerDefinition: checked.producerDefinition,
					}),
					producerItemInstanceId: action.producerItemInstanceId,
					save,
				})
			: readProducerDefaultLineId({
					lineIds: readProducerLineIds({
						producerDefinition: checked.producerDefinition,
					}),
					producerItemInstanceId: action.producerItemInstanceId,
					save,
				});
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const nextLineId = previousLineId === action.lineId ? undefined : action.lineId;
	const nextLineState = readNextProducerLineState({
		lineKind,
		nextLineId,
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
				nextLineId,
				previousLineId,
				producerItemInstanceId: action.producerItemInstanceId,
				type: "producer.line.default_changed" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
