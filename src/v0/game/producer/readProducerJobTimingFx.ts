import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobEffectiveProductLineFx } from "~/v0/game/producer/readProducerJobEffectiveProductLineFx";

export namespace readProducerJobTimingFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		producerItemInstanceId: string;
		productId: string;
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
	productId,
	save,
	startAtMs,
}: readProducerJobTimingFx.Props) {
	const effectiveProductLine = yield* readProducerJobEffectiveProductLineFx({
		config,
		ignoredProducerJobIds,
		nowMs: startAtMs,
		producerItemInstanceId,
		productId,
		save,
	});
	return {
		readyAtMs: startAtMs + effectiveProductLine.durationMs,
		startAtMs,
	} satisfies readProducerJobTimingFx.Result;
});
