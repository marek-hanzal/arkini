import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";

export const readBoardMemoryEngineResultFx = Effect.fn("readBoardMemoryEngineResultFx")(function* ({
	config,
	events,
	nextSave,
	nowMs,
}: {
	config: GameConfig;
	events: GameEvent[];
	nextSave: GameSave;
	nowMs: number;
}) {
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
