import { Effect } from "effect";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { planActivationInputRefsFx } from "~/v0/game/activation/planActivationInputRefsFx";
import { readLineStoredInputQuantitiesFx } from "~/v0/game/producer/readLineStoredInputQuantitiesFx";

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
