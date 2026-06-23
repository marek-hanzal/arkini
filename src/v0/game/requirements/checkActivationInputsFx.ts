import { Effect } from "effect";
import { mergeActivationInputRequirementsFx } from "~/v0/game/requirements/mergeActivationInputRequirementsFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import { sumResolvedInputRefsFx } from "~/v0/game/requirements/sumResolvedInputRefsFx";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameActionItemRefSchema } from "~/v0/game/action/GameActionItemRefSchema";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace checkActivationInputsFx {
	export interface Props {
		save: GameSave;
		inputs: readonly GameActivationInput[];
		inputRefs: readonly GameActionItemRefSchema.Type[];
	}
}

export const checkActivationInputsFx = Effect.fn("checkActivationInputsFx")(function* ({
	save,
	inputs,
	inputRefs,
}: checkActivationInputsFx.Props) {
	const requiredByItemId = yield* mergeActivationInputRequirementsFx({
		inputs,
	});
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs,
		save,
	});
	const selectedByItemId = yield* sumResolvedInputRefsFx({
		refs: resolvedRefs,
	});

	for (const [itemId, selectedQuantity] of Object.entries(selectedByItemId)) {
		const required = requiredByItemId[itemId];
		if (!required) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" is not required by this activation.`,
				),
			);
		}
		if (selectedQuantity !== required.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" quantity mismatch (${selectedQuantity}/${required.quantity}).`,
				),
			);
		}
	}

	for (const [itemId, required] of Object.entries(requiredByItemId)) {
		if (!required) continue;
		const selectedQuantity = readGameItemQuantity({
			itemId,
			quantities: selectedByItemId,
		});
		if (selectedQuantity !== required.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" quantity mismatch (${selectedQuantity}/${required.quantity}).`,
				),
			);
		}
	}

	const consumedItemIds = new Set(
		Object.entries(requiredByItemId)
			.filter(([, requirement]) => requirement?.consume)
			.map(([itemId]) => itemId),
	);

	return {
		consumedItemIds,
		resolvedRefs: resolvedRefs satisfies GameActionResolvedInputRef[],
	};
});
