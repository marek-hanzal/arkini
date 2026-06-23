import { Effect } from "effect";
import type { GameActionItemRef } from "~/v0/game/action/GameActionItemRefSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import { checkStashResolvedInputsFitFx } from "~/v0/game/stash/checkStashResolvedInputsFitFx";
import { planStashAutoFillInputRefsFx } from "~/v0/game/stash/planStashAutoFillInputRefsFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";

export namespace resolveStashOpenInputRefsFx {
	export interface Props {
		inputRefs: readonly GameActionItemRef[];
		inputs: readonly GameActivationInput[];
		save: GameSave;
		stashItemInstanceId: string;
	}
}

export const resolveStashOpenInputRefsFx = Effect.fn("resolveStashOpenInputRefsFx")(function* ({
	inputRefs,
	inputs,
	save,
	stashItemInstanceId,
}: resolveStashOpenInputRefsFx.Props) {
	const shouldAutoFillInputs = inputRefs.length === 0 && inputs.length > 0;
	const selectedInputRefs = shouldAutoFillInputs
		? yield* planStashAutoFillInputRefsFx({
				inputs,
				save,
				stashItemInstanceId,
			})
		: inputRefs;
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs: selectedInputRefs,
		save,
	});

	yield* checkStashResolvedInputsFitFx({
		inputs,
		resolvedRefs,
		save,
		stashItemInstanceId,
	});

	return {
		resolvedRefs,
		shouldAutoFillInputs,
	};
});
