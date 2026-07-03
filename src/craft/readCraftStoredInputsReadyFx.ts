import { Effect } from "effect";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readCraftInputQuantitiesFx } from "~/craft/readCraftInputQuantitiesFx";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export namespace readCraftStoredInputsReadyFx {
	export interface Props {
		inputs: readonly GameCraftRecipeDefinition["inputs"][number][];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readCraftStoredInputsReadyFx = Effect.fn("readCraftStoredInputsReadyFx")(function* ({
	inputs,
	save,
	targetItemInstanceId,
}: readCraftStoredInputsReadyFx.Props) {
	const storedInputs = yield* readCraftInputQuantitiesFx({
		save,
		targetItemInstanceId,
	});
	return inputs.every(
		(input) =>
			readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputs,
			}) >= input.quantity,
	);
});
