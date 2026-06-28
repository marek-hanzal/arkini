import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProximityRequirementsDurationMultiplier } from "~/v0/game/requirements/readProximityRequirementsDurationMultiplier";

export namespace readCraftJobEffectiveTimingFx {
	export interface Props {
		recipe: GameConfig["craftRecipes"][string];
		save: GameSave;
		startAtMs: number;
		targetItemInstanceId: string;
	}
}

export const readCraftJobEffectiveTimingFx = Effect.fn("readCraftJobEffectiveTimingFx")(function* ({
	recipe,
	save,
	startAtMs,
	targetItemInstanceId,
}: readCraftJobEffectiveTimingFx.Props) {
	const durationMultiplier = readProximityRequirementsDurationMultiplier({
		requirements: recipe.requirements,
		save,
		targetItemInstanceId,
	});
	const durationMs = Math.max(0, Math.ceil(recipe.durationMs * durationMultiplier));

	return {
		durationMs,
		readyAtMs: startAtMs + durationMs,
		startAtMs,
	};
});
