import { Effect } from "effect";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { planActivationInputRefsFx } from "~/activation/planActivationInputRefsFx";
import { readLineStoredInputQuantitiesFx } from "~/producer/readLineStoredInputQuantitiesFx";

export namespace planLineAutoFillInputRefsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
		itemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const planLineAutoFillInputRefsFx = Effect.fn("planLineAutoFillInputRefsFx")(function* ({
	inputs,
	itemInstanceId,
	lineId,
	save,
}: planLineAutoFillInputRefsFx.Props) {
	const storedInputs = yield* readLineStoredInputQuantitiesFx({
		itemInstanceId,
		lineId,
		save,
	});

	return yield* planActivationInputRefsFx({
		excludedBoardItemIds: new Set([
			itemInstanceId,
		]),
		inputs,
		save,
		storedInputQuantities: storedInputs,
	});
});
