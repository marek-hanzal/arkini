import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { pastDueWorldJobWakeDelayMs } from "~/v0/game/world/pastDueWorldJobWakeDelayMs";
import { readWorldWakePlanFx } from "~/v0/game/world/readWorldWakePlanFx";

export const pastDueGameJobWakeDelayMs = pastDueWorldJobWakeDelayMs;

export namespace readNextWakeAtMsFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

export const readNextWakeAtMsFx = Effect.fn("readNextWakeAtMsFx")(function* ({
	config,
	nowMs,
	save,
}: readNextWakeAtMsFx.Props) {
	const wakePlan = yield* readWorldWakePlanFx({
		config,
		nowMs,
		save,
	});
	return wakePlan.nextWakeAtMs;
});
