import { Effect } from "effect";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readCraftRecipeDurationMs } from "~/craft/readCraftRecipeDurationMs";

export namespace readCraftJobEffectiveTimingFx {
	export interface Props {
		recipe: GameCraftRecipeDefinition;
		save: GameSave;
		startAtMs: number;
		targetItemInstanceId: string;
	}
}

export const readCraftJobEffectiveTimingFx = Effect.fn("readCraftJobEffectiveTimingFx")(function* ({
	recipe,
	save,
	startAtMs,
}: readCraftJobEffectiveTimingFx.Props) {
	const durationMs = readCraftRecipeDurationMs({
		recipe,
		save,
	});

	return {
		durationMs,
		readyAtMs: startAtMs + durationMs,
		startAtMs,
	};
});
