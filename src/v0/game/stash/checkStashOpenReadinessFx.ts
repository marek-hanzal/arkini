import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { planStashAutoFillInputRefsFx } from "~/v0/game/stash/planStashAutoFillInputRefsFx";
import { readStashBoardItemFx } from "~/v0/game/stash/readStashBoardItemFx";
import { readStashRemainingChargesFx } from "~/v0/game/stash/readStashRemainingChargesFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import { checkStashResolvedInputsFitFx } from "~/v0/game/stash/checkStashResolvedInputsFitFx";
import { readStashSelectedInputQuantities } from "~/v0/game/stash/readStashSelectedInputQuantities";
import { readStashStoredInputQuantity } from "~/v0/game/stash/readStashStoredInputQuantity";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameActionStashOpen } from "~/v0/game/action/GameActionStashOpen";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
				(selectedByItemId.get(input.itemId) ?? 0) >=
			input.quantity,
	);
	if (hasProgress || readyAfterSelection) return undefined;

	return GameEngineError.actionRejected(
		"input_mismatch",
		"Stash inputs are missing.",
	);
};

export const checkStashOpenReadinessFx = Effect.fn("checkStashOpenReadinessFx")(function* ({
	config,
	save,
	action,
}: checkStashOpenReadinessFx.Props) {
	const stashItem = yield* readStashBoardItemFx({
		config,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	const stashId = config.items[stashItem.itemId]?.stashId;
	const stash = stashId ? config.stashes[stashId] : undefined;
	if (!stashId || !stash) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Stash item "${stashItem.itemId}" references missing stash.`,
			),
		);
	}
	if (!config.lootTables[stash.outputTableId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing loot table "${stash.outputTableId}".`),
		);
	}

	const remainingCharges = yield* readStashRemainingChargesFx({
		config,
		save,
		stashId,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	if (remainingCharges <= 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"stash_depleted",
				`Stash "${action.stashItemInstanceId}" has no charges left.`,
			),
		);
	}

	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.stashItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: stash.requirements,
		save,
		storedItems,
	});
	yield* match(stash.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();

	const inputRefs =
		action.inputRefs.length === 0 && stash.inputs.length > 0
			? yield* planStashAutoFillInputRefsFx({
					inputs: stash.inputs,
					save,
					stashItemInstanceId: action.stashItemInstanceId,
				})
			: action.inputRefs;
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs,
		save,
	});
	yield* checkStashResolvedInputsFitFx({
		inputs: stash.inputs,
		resolvedRefs,
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
