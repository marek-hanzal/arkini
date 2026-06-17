import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/v0/game/engine/fx/consumeResolvedInputRefFx";
import { mergeActivationInputRequirementsFx } from "~/v0/game/engine/fx/mergeActivationInputRequirementsFx";
import { resolveInputRefsFx } from "~/v0/game/engine/fx/resolveInputRefsFx";
import { sumResolvedInputRefsFx } from "~/v0/game/engine/fx/sumResolvedInputRefsFx";
import type { GameActivationInput } from "~/v0/game/engine/model/GameActivationInput";
import type { GameActionItemRefSchema } from "~/v0/game/engine/model/GameActionItemRefSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace consumeActivationInputsFx {
	export interface Props {
		save: GameSave;
		inputs: readonly GameActivationInput[];
		inputRefs: readonly GameActionItemRefSchema.Type[];
		nowMs: number;
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
	}
}

export const consumeActivationInputsFx = Effect.fn("consumeActivationInputsFx")(function* ({
	save,
	inputs,
	inputRefs,
	nowMs,
	reason,
}: consumeActivationInputsFx.Props) {
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

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const consumedItemIds = new Set(
		[
			...requiredByItemId,
		]
			.filter(([, requirement]) => requirement.consume)
			.map(([itemId]) => itemId),
	);

	for (const ref of resolvedRefs) {
		if (!consumedItemIds.has(ref.itemId)) {
			continue;
		}

		yield* consumeResolvedInputRefFx({
			events,
			nextSave,
			reason,
			ref,
		});
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		save: nextSave,
	};
});
