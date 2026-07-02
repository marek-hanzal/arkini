import { Effect } from "effect";
import { checkLineSetDefaultReadinessFx } from "~/v0/game/producer/checkLineSetDefaultReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readDefaultEffectLineId } from "~/v0/game/producer/readDefaultEffectLineId";
import { readDefaultLineId } from "~/v0/game/producer/readDefaultLineId";
import { readLineKind } from "~/v0/game/producer/readLineKind";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { readLineDefinition, readLineIds } from "~/v0/game/config/GameItemCapabilities";
import type { GameActionLineSetDefault } from "~/v0/game/action/GameActionLineSetDefault";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace setLineDefaultFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionLineSetDefault;
		nowMs: number;
	}
}

const readNextLineState = ({
	kind,
	nextLineId,
	previousState,
}: {
	kind: "effect" | "product";
	nextLineId: string | undefined;
	previousState: GameSave["lines"][string] | undefined;
}): GameSave["lines"][string] | undefined => {
	const nextState = {
		...(previousState ?? {}),
		...(kind === "effect"
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

export const setLineDefaultFx = Effect.fn("setLineDefaultFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: setLineDefaultFx.Props) {
	const checked = yield* checkLineSetDefaultReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const line = readLineDefinition({
		producerDefinition: checked.producerDefinition,
		lineId: action.lineId,
	});
	if (!line) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing line "${action.lineId}".`),
		);
	}

	const kind = readLineKind({
		line,
	});
	const previousLineId =
		kind === "effect"
			? readDefaultEffectLineId({
					lineIds: readLineIds({
						producerDefinition: checked.producerDefinition,
					}),
					itemInstanceId: action.itemInstanceId,
					save,
				})
			: readDefaultLineId({
					lineIds: readLineIds({
						producerDefinition: checked.producerDefinition,
					}),
					itemInstanceId: action.itemInstanceId,
					save,
				});
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const nextLineId = previousLineId === action.lineId ? undefined : action.lineId;
	const nextLineState = readNextLineState({
		kind,
		nextLineId,
		previousState: nextSave.lines[action.itemInstanceId],
	});

	if (nextLineState) {
		nextSave.lines[action.itemInstanceId] = nextLineState;
	} else {
		delete nextSave.lines[action.itemInstanceId];
	}
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				atMs: nowMs,
				nextLineId,
				previousLineId,
				itemInstanceId: action.itemInstanceId,
				type: "line.default_changed" as const,
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
