import { Effect } from "effect";
import type { BoardMemoryActivationScope } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";

export const readBoardMemoryEngineResultFx = Effect.fn("readBoardMemoryEngineResultFx")(function* ({
	scope,
}: {
	scope: BoardMemoryActivationScope;
}) {
	const { config, events, nextSave, nowMs } = scope;
	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
