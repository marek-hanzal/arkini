import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import { readStashStoredInputQuantity } from "~/v0/game/stash/readStashStoredInputQuantity";

export namespace readStashInputsReady {
	export interface Props {
		inputs: readonly GameActivationInput[];
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const readStashInputsReady = ({
	inputs,
	save,
	stashItemInstanceId,
}: readStashInputsReady.Props) =>
	inputs.every(
		(input) =>
			readStashStoredInputQuantity({
				itemId: input.itemId,
				save,
				stashItemInstanceId,
			}) >= input.quantity,
	);
