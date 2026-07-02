import { Effect } from "effect";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { planActivationInputRefsFx } from "~/activation/planActivationInputRefsFx";
import { readCraftInputQuantitiesFx } from "~/craft/readCraftInputQuantitiesFx";

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
