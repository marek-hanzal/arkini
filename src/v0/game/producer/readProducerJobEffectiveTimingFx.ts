import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobEffectiveLineFx } from "~/v0/game/producer/readProducerJobEffectiveLineFx";

export namespace readProducerJobEffectiveTimingFx {
	export interface Props {
		config: GameConfig;
		evaluateAtMs: number;
		ignoredProducerJobIds?: ReadonlySet<string>;
		job: GameSaveProducerJob;
		save: GameSave;
		startAtMs: number;
	}

	export interface Result {
		readyAtMs: number;
		startAtMs: number;
	}
}

export const readProducerJobEffectiveTimingFx = Effect.fn("readProducerJobEffectiveTimingFx")(
	function* ({
		config,
		evaluateAtMs,
		ignoredProducerJobIds,
		job,
		save,
		startAtMs,
	}: readProducerJobEffectiveTimingFx.Props) {
		const effectiveLine = yield* readProducerJobEffectiveLineFx({
			config,
			ignoredProducerJobIds,
			nowMs: evaluateAtMs,
			itemInstanceId: job.itemInstanceId,
			lineId: job.lineId,
			save,
		});

		return {
			readyAtMs: startAtMs + effectiveLine.durationMs,
			startAtMs,
		} satisfies readProducerJobEffectiveTimingFx.Result;
	},
);
