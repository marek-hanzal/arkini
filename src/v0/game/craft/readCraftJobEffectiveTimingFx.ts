import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameCraftRecipeDefinition } from "~/v0/game/config/GameItemCapabilities";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readCraftRecipeDurationMs } from "~/v0/game/craft/readCraftRecipeDurationMs";

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
	targetItemInstanceId,
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
