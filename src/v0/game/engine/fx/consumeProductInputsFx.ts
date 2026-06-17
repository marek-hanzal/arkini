import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/v0/game/engine/fx/consumeResolvedInputRefFx";
import { mergeProductInputRequirementsFx } from "~/v0/game/engine/fx/mergeProductInputRequirementsFx";
import { resolveInputRefsFx } from "~/v0/game/engine/fx/resolveInputRefsFx";
import { sumResolvedInputRefsFx } from "~/v0/game/engine/fx/sumResolvedInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/engine/model/GameActionProducerProductStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace consumeProductInputsFx {
	export interface Props {
		save: GameSave;
		inputs: GameConfig["products"][string]["inputs"];
		inputRefs: GameActionProducerProductStart["inputRefs"];
		nowMs: number;
	}
}

export const consumeProductInputsFx = Effect.fn("consumeProductInputsFx")(function* ({
	save,
	inputs,
	inputRefs,
	nowMs,
}: consumeProductInputsFx.Props) {
	const requiredByItemId = yield* mergeProductInputRequirementsFx({
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
					`Input "${itemId}" is not required by this product.`,
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
			ref,
		});
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		save: nextSave,
	};
});
