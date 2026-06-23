import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { planActivationInputRefsFx } from "~/v0/game/requirements/planActivationInputRefsFx";
import { readStashInputQuantitiesFx } from "~/v0/game/stash/readStashInputQuantitiesFx";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";

export namespace planStashAutoFillInputRefsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const planStashAutoFillInputRefsFx = Effect.fn("planStashAutoFillInputRefsFx")(function* ({
	inputs,
	save,
	stashItemInstanceId,
}: planStashAutoFillInputRefsFx.Props) {
	const storedInputs = yield* readStashInputQuantitiesFx({
		save,
		stashItemInstanceId,
	});

	return yield* planActivationInputRefsFx({
		excludedBoardItemIds: new Set([
			stashItemInstanceId,
		]),
		inputs,
		save,
		storedInputQuantities: storedInputs,
	});
});
