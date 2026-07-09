import { loadDefaultGameConfig } from "~/config/compiled/defaultGameConfig";
import { createInitialGameSaveFx } from "~/save/createInitialGameSaveFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { syncRealtimeWorldJobsFx } from "~/world/syncRealtimeWorldJobsFx";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";
import type {
	RuntimeGameEngineAdapterOptions,
	RuntimeGameEngineAdapterRequiredOptions,
} from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export const readInitialRuntimeGameEngineAdapterOptions = async ({
	config,
	initialSave,
	nowMs = Date.now(),
	random,
}: RuntimeGameEngineAdapterOptions = {}): Promise<RuntimeGameEngineAdapterRequiredOptions> => {
	const resolvedConfig = config ?? (await loadDefaultGameConfig());
	const save =
		initialSave ??
		(await runGameEngineEffect(
			createInitialGameSaveFx({
				config: resolvedConfig,
				nowMs,
			}),
			{
				random,
			},
		));

	const syncedSave = await runGameEngineEffect(
		syncRealtimeWorldJobsFx({
			config: resolvedConfig,
			nowMs,
			save,
		}),
		{
			random,
		},
	);
	const nextWakeAtMs = await runGameEngineEffect(
		readNextWakeAtMsFx({
			config: resolvedConfig,
			nowMs,
			save: syncedSave,
		}),
		{
			random,
		},
	);

	return {
		config: resolvedConfig,
		initialSave: syncedSave,
		nextWakeAtMs,
		random,
	};
};
