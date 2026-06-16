import type { DevScenarioId } from "~/v0/debug/scenario/DevScenarioDefinitions";

export namespace DevScenarioRuntime {
	export interface LastLoadedScenario {
		scenarioId: DevScenarioId;
		loadedAtIso: string;
	}
}

let lastLoadedScenario: DevScenarioRuntime.LastLoadedScenario | undefined;

export const setLastLoadedDevScenario = (scenarioId: DevScenarioId) => {
	lastLoadedScenario = {
		scenarioId,
		loadedAtIso: new Date().toISOString(),
	};
};

export const readLastLoadedDevScenario = () => lastLoadedScenario;
