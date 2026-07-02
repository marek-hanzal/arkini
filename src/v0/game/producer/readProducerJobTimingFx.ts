import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobEffectiveLineFx } from "~/v0/game/producer/readProducerJobEffectiveLineFx";

export namespace readProducerJobTimingFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		producerItemInstanceId: string;
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
	producerItemInstanceId,
	lineId,
	save,
	startAtMs,
}: readProducerJobTimingFx.Props) {
	const effectiveProducerLine = yield* readProducerJobEffectiveLineFx({
		config,
		ignoredProducerJobIds,
		nowMs: startAtMs,
		producerItemInstanceId,
		lineId,
		save,
	});
	return {
		readyAtMs: startAtMs + effectiveProducerLine.durationMs,
		startAtMs,
	} satisfies readProducerJobTimingFx.Result;
});
