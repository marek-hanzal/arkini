import { Effect } from "effect";
import { mergeActivationInputDemandsFx } from "~/activation/mergeActivationInputDemandsFx";
import { readActivationInputSelectedQuantityAccepted } from "~/activation/readActivationInputSelectedQuantityAccepted";
import { resolveInputRefsFx } from "~/activation/resolveInputRefsFx";
import { sumResolvedInputRefsFx } from "~/activation/sumResolvedInputRefsFx";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import type { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

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
	const demandedByItemId = yield* mergeActivationInputDemandsFx({
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
		const demand = demandedByItemId[itemId];
		if (!demand) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" is not used by this activation.`,
				),
			);
		}
		if (
			!readActivationInputSelectedQuantityAccepted({
				input: demand,
				selectedQuantity,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" quantity mismatch (${selectedQuantity}/${demand.quantity}).`,
				),
			);
		}
	}

	for (const [itemId, demand] of Object.entries(demandedByItemId)) {
		if (!demand) continue;
		const selectedQuantity = readGameItemQuantity({
			itemId,
			quantities: selectedByItemId,
		});
		if (
			!readActivationInputSelectedQuantityAccepted({
				input: demand,
				selectedQuantity,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Input "${itemId}" quantity mismatch (${selectedQuantity}/${demand.quantity}).`,
				),
			);
		}
	}

	const consumedItemIds = new Set(
		Object.entries(demandedByItemId)
			.filter(([, demand]) => demand?.consume)
			.map(([itemId]) => itemId),
	);

	return {
		consumedItemIds,
		resolvedRefs: resolvedRefs satisfies GameActionResolvedInputRef[],
	};
});
