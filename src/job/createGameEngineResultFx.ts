import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";

export namespace createGameEngineResultFx {
	export interface Props {
		config: GameConfig;
		events: readonly GameEvent[];
		nowMs: number;
		save: GameSave;
	}
}

export const createGameEngineResultFx = Effect.fn("createGameEngineResultFx")(function* ({
	config,
	events,
	nowMs,
	save,
}: createGameEngineResultFx.Props) {
	return {
		events: [
			...events,
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save,
		}),
		save,
	} satisfies GameEngineResult;
});
