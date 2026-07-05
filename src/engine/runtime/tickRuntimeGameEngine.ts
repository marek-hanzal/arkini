import { runGameTickFx } from "~/engine/runGameTickFx";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { RuntimeGameEngineAdapterScope } from "~/engine/runtime/RuntimeGameEngineAdapterScope";
import type { RuntimeGameEngineTickProps } from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export const tickRuntimeGameEngine = async (
	scope: RuntimeGameEngineAdapterScope,
	{ nowMs = Date.now() }: RuntimeGameEngineTickProps = {},
): Promise<GameEngineResult> => {
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

	scope.publish({
		nowMs,
		result,
	});

	return result;
};
