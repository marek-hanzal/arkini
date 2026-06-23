import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import { readStashInputCapacity } from "~/v0/game/stash/readStashInputCapacity";
import { readStashSelectedInputQuantities } from "~/v0/game/stash/readStashSelectedInputQuantities";
import { readStashStoredInputQuantity } from "~/v0/game/stash/readStashStoredInputQuantity";

export namespace checkStashResolvedInputsFitFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
		resolvedRefs: readonly GameActionResolvedInputRef[];
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const checkStashResolvedInputsFitFx = Effect.fn("checkStashResolvedInputsFitFx")(function* ({
	inputs,
	resolvedRefs,
	save,
	stashItemInstanceId,
}: checkStashResolvedInputsFitFx.Props) {
	const selectedByItemId = readStashSelectedInputQuantities(resolvedRefs);

	for (const [itemId, selectedQuantity] of Object.entries(selectedByItemId)) {
		const input = inputs.find((candidate) => candidate.itemId === itemId);
		if (!input) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" is not required by this stash.`,
				),
			);
		}

		const nextQuantity =
			readStashStoredInputQuantity({
				itemId,
				save,
				stashItemInstanceId,
			}) + selectedQuantity;
		const capacity = readStashInputCapacity(input);
		if (nextQuantity > capacity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" overfills this stash (${nextQuantity}/${capacity}).`,
				),
			);
		}
	}
});
