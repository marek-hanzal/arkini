import { Effect } from "effect";
import { mergeActivationInputRequirementsFx } from "~/v0/game/engine/fx/mergeActivationInputRequirementsFx";
import { resolveInputRefsFx } from "~/v0/game/engine/fx/resolveInputRefsFx";
import { sumResolvedInputRefsFx } from "~/v0/game/engine/fx/sumResolvedInputRefsFx";
import type { GameActivationInput } from "~/v0/game/engine/model/GameActivationInput";
import type { GameActionItemRefSchema } from "~/v0/game/engine/model/GameActionItemRefSchema";
import type { GameActionResolvedInputRef } from "~/v0/game/engine/model/GameActionResolvedInputRef";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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

	for (const [itemId, selectedQuantity] of selectedByItemId) {
		if (!requiredByItemId.has(itemId)) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" is not required by this activation.`,
				),
			);
		}
		const required = requiredByItemId.get(itemId);
		if (required && selectedQuantity !== required.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" quantity mismatch (${selectedQuantity}/${required.quantity}).`,
				),
			);
		}
	}

	for (const [itemId, required] of requiredByItemId) {
		const selectedQuantity = selectedByItemId.get(itemId) ?? 0;
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
		[
			...requiredByItemId,
		]
			.filter(([, requirement]) => requirement.consume)
			.map(([itemId]) => itemId),
	);

	return {
		consumedItemIds,
		resolvedRefs: resolvedRefs satisfies GameActionResolvedInputRef[],
	};
});
