import { Effect } from "effect";
import type { RunGameTickInput } from "~/v0/game/engine/logic/runGameTick";
import { runGameTick } from "~/v0/game/engine/logic/runGameTick";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";

export const runGameTickFx = (input: RunGameTickInput): Effect.Effect<GameEngineResult> =>
	Effect.sync(() => runGameTick(input));
