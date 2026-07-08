import { Effect } from "effect";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readGameSaveDraftCurrentFx } from "~/save/GameSaveDraftScopeFx";

export const readProducerJobSyncStartAtMsFx = Effect.fn("readProducerJobSyncStartAtMsFx")(
	function* ({
		cursorAtMs,
		job,
		nowMs,
	}: {
		cursorAtMs: number;
		job: GameSaveProducerJob;
		nowMs: number;
	}) {
		const save = yield* readGameSaveDraftCurrentFx();
		return readGameCheatSpeedMode({
			save,
		}) === "instant"
			? Math.max(cursorAtMs, Math.min(job.startAtMs, nowMs))
			: Math.max(job.startAtMs, cursorAtMs);
	},
);
