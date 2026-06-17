import { useCallback, useMemo, useState } from "react";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { createGameSaveFromDevScenario } from "~/v0/debug/scenario/createGameSaveFromDevScenario";
import type { DevScenarioId } from "~/v0/debug/scenario/DevScenarioDefinitions";
import { setLastLoadedDevScenario } from "~/v0/debug/scenario/DevScenarioRuntime";
import { useGameRuntimeStore } from "~/v0/play/runtime";

export namespace useLoadDevScenarioAction {
	export interface Input {
		scenarioId: DevScenarioId;
	}

	export interface Result {
		boardItemCount: number;
		inventoryStackCount: number;
		scenarioId: DevScenarioId;
	}
}

export const useLoadDevScenarioAction = () => {
	const store = useGameRuntimeStore();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<unknown>(undefined);
	const [data, setData] = useState<useLoadDevScenarioAction.Result | undefined>(undefined);

	const run = useCallback(
		async ({ scenarioId }: useLoadDevScenarioAction.Input) => {
			setIsPending(true);
			setError(undefined);
			setData(undefined);
			DebugTimeline.record({
				detail: {
					scenarioId,
				},
				event: "scenario.load.start",
				scope: "dev-scenario",
			});
			try {
				const nowMs = Date.now();
				const config = store.getSnapshot().runtime.config;
				const save = createGameSaveFromDevScenario({
					config,
					nowMs,
					scenarioId,
				});
				await store.replaceSave({
					nowMs,
					save,
				});
				const result = {
					boardItemCount: Object.keys(save.board.items).length,
					inventoryStackCount: save.inventory.slots.filter(Boolean).length,
					scenarioId,
				} satisfies useLoadDevScenarioAction.Result;
				setData(result);
				setLastLoadedDevScenario(scenarioId);
				DebugTimeline.record({
					detail: result,
					event: "scenario.load.success",
					scope: "dev-scenario",
				});
				return result;
			} catch (nextError) {
				setError(nextError);
				DebugTimeline.record({
					detail: {
						error: nextError,
						scenarioId,
					},
					event: "scenario.load.error",
					scope: "dev-scenario",
				});
				throw nextError;
			} finally {
				setIsPending(false);
			}
		},
		[
			store,
		],
	);

	return useMemo(
		() => ({
			data,
			error,
			isError: Boolean(error),
			isPending,
			isSuccess: Boolean(data) && !error,
			run,
		}),
		[
			data,
			error,
			isPending,
			run,
		],
	);
};
