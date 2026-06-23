import { Effect } from "effect";
import { match } from "ts-pattern";
import { readStashSelectedInputQuantities } from "~/v0/game/stash/readStashSelectedInputQuantities";
import { readStashStoredInputQuantity } from "~/v0/game/stash/readStashStoredInputQuantity";
import { resolveStashOpenInputRefsFx } from "~/v0/game/stash/resolveStashOpenInputRefsFx";
import { readStashOpenCoreFx } from "~/v0/game/stash/readStashOpenCoreFx";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameActionStashOpen } from "~/v0/game/action/GameActionStashOpen";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace checkStashOpenReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStashOpen;
	}
}

const checkSelectedInputsCanProgressOrOpen = ({
	inputs,
	resolvedRefs,
	save,
	stashItemInstanceId,
}: {
	inputs: readonly GameActivationInput[];
	resolvedRefs: readonly GameActionResolvedInputRef[];
	save: GameSave;
	stashItemInstanceId: string;
}) => {
	if (inputs.length === 0) return undefined;

	const selectedByItemId = readStashSelectedInputQuantities(resolvedRefs);
	const hasProgress = resolvedRefs.length > 0;
	const readyAfterSelection = inputs.every(
		(input) =>
			readStashStoredInputQuantity({
				itemId: input.itemId,
				save,
				stashItemInstanceId,
			}) +
				readGameItemQuantity({
					itemId: input.itemId,
					quantities: selectedByItemId,
				}) >=
			input.quantity,
	);
	if (hasProgress || readyAfterSelection) return undefined;

	return GameEngineError.actionRejected("input_mismatch", "Stash inputs are missing.");
};

export const checkStashOpenReadinessFx = Effect.fn("checkStashOpenReadinessFx")(function* ({
	config,
	save,
	action,
}: checkStashOpenReadinessFx.Props) {
	const { remainingCharges, stash, stashId, stashItem } = yield* readStashOpenCoreFx({
		config,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	yield* match(stash.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();

	const { resolvedRefs } = yield* resolveStashOpenInputRefsFx({
		inputRefs: action.inputRefs,
		inputs: stash.inputs,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	const inputError = checkSelectedInputsCanProgressOrOpen({
		inputs: stash.inputs,
		resolvedRefs,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	if (inputError) return yield* Effect.fail(inputError);

	return {
		remainingCharges,
		stash,
		stashId,
		stashItem,
	};
});
