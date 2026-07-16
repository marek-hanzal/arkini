import type { GameEngineResult } from "~/engine/model/GameEngineResult";

export const combineGameEngineResults = (results: readonly GameEngineResult[]) => {
	const lastResult = results.at(-1);
	if (!lastResult) return null;

	return {
		events: results.flatMap((result) => result.events),
		nextWakeAtMs: lastResult.nextWakeAtMs,
		save: lastResult.save,
	} satisfies GameEngineResult;
};
