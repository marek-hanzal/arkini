import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { pastDueWorldJobWakeDelayMs } from "~/world/pastDueWorldJobWakeDelayMs";
import { readWorldWakePlanFx } from "~/world/readWorldWakePlanFx";

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
