import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameCraftRecipeDefinition } from "~/v0/game/config/GameItemCapabilities";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { planActivationInputRefsFx } from "~/v0/game/activation/planActivationInputRefsFx";
import { readCraftInputQuantitiesFx } from "~/v0/game/craft/readCraftInputQuantitiesFx";

export namespace planCraftAutoFillInputRefsFx {
	export interface Props {
		inputs: readonly GameCraftRecipeDefinition["inputs"][number][];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const planCraftAutoFillInputRefsFx = Effect.fn("planCraftAutoFillInputRefsFx")(function* ({
	inputs,
	save,
	targetItemInstanceId,
}: planCraftAutoFillInputRefsFx.Props) {
	const storedInputs = yield* readCraftInputQuantitiesFx({
		save,
		targetItemInstanceId,
	});

	return yield* planActivationInputRefsFx({
		excludedBoardItemIds: new Set([
			targetItemInstanceId,
		]),
		inputs,
		save,
		storedInputQuantities: storedInputs,
	});
});
