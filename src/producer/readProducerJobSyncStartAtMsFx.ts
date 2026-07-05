import { Effect } from "effect";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { ProducerRealtimeSyncScope } from "~/producer/ProducerRealtimeSyncTypes";
import { readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";

export const readProducerJobSyncStartAtMsFx = Effect.fn("readProducerJobSyncStartAtMsFx")(
	function* ({
		cursorAtMs,
		job,
		scope,
	}: {
		cursorAtMs: number;
		job: GameSaveProducerJob;
		scope: ProducerRealtimeSyncScope;
	}) {
		const { nowMs } = scope;
		const save = yield* readGameSaveDraftCurrentFx();
		return readGameCheatSpeedMode({
			save,
		}) === "instant"
			? Math.max(cursorAtMs, Math.min(job.startAtMs, nowMs))
			: Math.max(job.startAtMs, cursorAtMs);
	},
);
