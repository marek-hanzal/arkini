import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { runGameFx } from "~/v0/fx/runGameFx";
import { refreshBoardAndInventoryCaches } from "~/v0/play/cache/refreshBoardAndInventoryCaches";
import { loadDevScenarioFx } from "~/v0/debug/scenario/loadDevScenarioFx";
import { setLastLoadedDevScenario } from "~/v0/debug/scenario/DevScenarioRuntime";

export const useLoadDevScenarioMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: loadDevScenarioFx.Props) => {
			DebugTimeline.record({
				scope: "dev-scenario",
				event: "scenario.load.start",
				detail: input,
			});
			const result = await runGameFx({
				effect: loadDevScenarioFx(input),
			});
			await refreshBoardAndInventoryCaches({
				queryClient,
			});
			setLastLoadedDevScenario(result.scenarioId);
			DebugTimeline.record({
				scope: "dev-scenario",
				event: "scenario.load.success",
				detail: result,
			});
			return result;
		},
		onError(error, input) {
			DebugTimeline.record({
				scope: "dev-scenario",
				event: "scenario.load.error",
				detail: {
					input,
					error,
				},
			});
			console.error(error);
		},
	});
};
