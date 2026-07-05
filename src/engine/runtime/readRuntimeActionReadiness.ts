import { readActionReadinessFx } from "~/engine/readActionReadinessFx";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";
import { catchUpDueRuntimeGameTicks } from "~/engine/runtime/catchUpDueRuntimeGameTicks";
import type { GameActionReadiness } from "~/action/GameActionReadiness";
import type { RuntimeGameEngineAdapterScope } from "~/engine/runtime/RuntimeGameEngineAdapterScope";
import type { RuntimeGameEngineReadinessProps } from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export const readRuntimeActionReadiness = async (
	scope: RuntimeGameEngineAdapterScope,
	{ action, nowMs = Date.now() }: RuntimeGameEngineReadinessProps,
): Promise<GameActionReadiness> => {
	await catchUpDueRuntimeGameTicks(scope, {
		nowMs,
	});

	return runGameEngineEffect(
		readActionReadinessFx({
			action,
			config: scope.config,
			nowMs,
			save: scope.readSave(),
		}),
		{
			random: scope.random,
		},
	);
};
