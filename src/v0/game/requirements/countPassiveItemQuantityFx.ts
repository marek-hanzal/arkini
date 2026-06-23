import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GamePassiveRequirementScope } from "~/v0/game/requirements/GamePassiveRequirementScope";
import { readGameSaveItemQuantityByScope } from "~/v0/game/requirements/readGameSaveItemQuantityByScope";

export namespace countPassiveItemQuantityFx {
	export interface Props {
		itemId: string;
		save: GameSave;
		scope: GamePassiveRequirementScope;
	}
}

export const countPassiveItemQuantityFx = Effect.fn("countPassiveItemQuantityFx")(function* (
	props: countPassiveItemQuantityFx.Props,
) {
	return readGameSaveItemQuantityByScope(props);
});
