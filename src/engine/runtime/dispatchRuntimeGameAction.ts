import { applyGameActionFx } from "~/engine/applyGameActionFx";
import { catchUpDueRuntimeGameTicks } from "~/engine/runtime/catchUpDueRuntimeGameTicks";
import { combineGameEngineResults } from "~/engine/runtime/combineGameEngineResults";
import { runGameEngineEffect } from "~/engine/runtime/runGameEngineEffect";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { RuntimeGameEngineAdapterScope } from "~/engine/runtime/RuntimeGameEngineAdapterScope";
import type { RuntimeGameEngineDispatchProps } from "~/engine/runtime/RuntimeGameEngineAdapterTypes";

export const dispatchRuntimeGameAction = async (
	scope: RuntimeGameEngineAdapterScope,
	{ action, nowMs = Date.now() }: RuntimeGameEngineDispatchProps,
): Promise<GameEngineResult> => {
	const catchUpResults = await catchUpDueRuntimeGameTicks(scope, {
		nowMs,
		publish: false,
	});

	let result: GameEngineResult;
	try {
		result = await runGameEngineEffect(
			applyGameActionFx({
				action,
				config: scope.config,
				nowMs,
				save: scope.readSave(),
			}),
			{
				random: scope.random,
			},
		);
	} catch (error) {
		const catchUpResult = combineGameEngineResults(catchUpResults);
		if (catchUpResult) {
			scope.publish({
				nowMs,
				result: catchUpResult,
			});
		}
		throw error;
	}

	const publishedResult =
		combineGameEngineResults([
			...catchUpResults,
			result,
		]) ?? result;
	scope.publish({
		nowMs,
		result: publishedResult,
	});

	return publishedResult;
};
