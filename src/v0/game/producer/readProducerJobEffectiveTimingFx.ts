import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobEffectiveProductLineFx } from "~/v0/game/producer/readProducerJobEffectiveProductLineFx";

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
		const effectiveProductLine = yield* readProducerJobEffectiveProductLineFx({
			config,
			ignoredProducerJobIds,
			nowMs: evaluateAtMs,
			producerItemInstanceId: job.producerItemInstanceId,
			productId: job.productId,
			save,
		});

		return {
			readyAtMs: startAtMs + effectiveProductLine.durationMs,
			startAtMs,
		} satisfies readProducerJobEffectiveTimingFx.Result;
	},
);
