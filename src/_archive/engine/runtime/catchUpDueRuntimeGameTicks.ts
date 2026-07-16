import { runGameTickFx } from "~/engine/runGameTickFx";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";
import { hasProcessableWorldJobs } from "~/world/hasProcessableWorldJobs";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { RuntimeGameEngineAdapterScope } from "~/engine/runtime/RuntimeGameEngineAdapterScope";

export interface CatchUpDueRuntimeGameTicksProps {
	nowMs: number;
	publish?: boolean;
}

export const catchUpDueRuntimeGameTicks = async (
	scope: RuntimeGameEngineAdapterScope,
	{ nowMs, publish = true }: CatchUpDueRuntimeGameTicksProps,
) => {
	let tickCount = 0;
	const results: GameEngineResult[] = [];
	while (hasDueRuntimeWork(scope, nowMs)) {
		tickCount += 1;
		if (tickCount > 100) {
			throw new Error("Game runtime catch-up exceeded 100 ready ticks.");
		}

		const result = await runGameEngineEffect(
			runGameTickFx({
				config: scope.config,
				nowMs,
				save: scope.readSave(),
			}),
			{
				random: scope.random,
			},
		);

		results.push(result);
		if (publish) {
			scope.publish({
				nowMs,
				result,
			});
		} else {
			scope.storeResult(result);
		}
	}

	return results;
};

const hasDueRuntimeWork = (scope: RuntimeGameEngineAdapterScope, nowMs: number) => {
	const nextWakeAtMs = scope.readNextWakeAtMs();

	return (
		(nextWakeAtMs !== null && nextWakeAtMs <= nowMs) ||
		hasProcessableWorldJobs({
			config: scope.config,
			nowMs,
			save: scope.readSave(),
		})
	);
};
