import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { syncRealtimeWorldJobsFx } from "~/world/syncRealtimeWorldJobsFx";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { RuntimeGameEngineAdapterScope } from "~/engine/runtime/RuntimeGameEngineAdapterScope";
import type { RuntimeGameEngineReplaceSaveProps } from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export const replaceRuntimeGameSave = async (
	scope: RuntimeGameEngineAdapterScope,
	{ events = [], nowMs = Date.now(), save }: RuntimeGameEngineReplaceSaveProps,
): Promise<GameEngineResult> => {
	const syncedSave = await runGameEngineEffect(
		syncRealtimeWorldJobsFx({
			config: scope.config,
			nowMs,
			save,
		}),
		{
			random: scope.random,
		},
	);
	const nextWakeAtMs = await runGameEngineEffect(
		readNextWakeAtMsFx({
			config: scope.config,
			nowMs,
			save: syncedSave,
		}),
		{
			random: scope.random,
		},
	);

	const result = {
		events: [
			...events,
		],
		nextWakeAtMs,
		save: {
			...syncedSave,
			updatedAtMs: nowMs,
		},
	} satisfies GameEngineResult;
	scope.publish({
		nowMs,
		result,
	});

	return result;
};
