import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobEffectiveLineFx } from "~/v0/game/producer/readProducerJobEffectiveLineFx";

export namespace readProducerJobTimingFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		itemInstanceId: string;
		lineId: string;
		save: GameSave;
		startAtMs: number;
	}

	export interface Result {
		readyAtMs: number;
		startAtMs: number;
	}
}

export const readProducerJobTimingFx = Effect.fn("readProducerJobTimingFx")(function* ({
	config,
	ignoredProducerJobIds,
	itemInstanceId,
	lineId,
	save,
	startAtMs,
}: readProducerJobTimingFx.Props) {
	const effectiveLine = yield* readProducerJobEffectiveLineFx({
		config,
		ignoredProducerJobIds,
		nowMs: startAtMs,
		itemInstanceId,
		lineId,
		save,
	});
	return {
		readyAtMs: startAtMs + effectiveLine.durationMs,
		startAtMs,
	} satisfies readProducerJobTimingFx.Result;
});
