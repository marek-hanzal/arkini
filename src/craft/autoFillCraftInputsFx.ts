import { Effect } from "effect";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { readCraftInputQuantitiesFx } from "~/craft/readCraftInputQuantitiesFx";
import { storeCraftResolvedInputFx } from "~/craft/storeCraftResolvedInputFx";
import { planCraftAutoFillInputRefsFx } from "~/craft/planCraftAutoFillInputRefsFx";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { resolveInputRefsFx } from "~/activation/resolveInputRefsFx";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export namespace autoFillCraftInputsFx {
	export interface Props {
		events: GameEvent[];
		inputs: readonly GameCraftRecipeDefinition["inputs"][number][];
		nextSave: GameSave;
		nowMs: number;
		recipeId: string;
		targetItemInstanceId: string;
	}
}

export const autoFillCraftInputsFx = Effect.fn("autoFillCraftInputsFx")(function* ({
	events,
	inputs,
	nextSave,
	nowMs,
	recipeId,
	targetItemInstanceId,
}: autoFillCraftInputsFx.Props) {
	const inputRefs = yield* planCraftAutoFillInputRefsFx({
		inputs,
		save: nextSave,
		targetItemInstanceId,
	});
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs,
		save: nextSave,
	});

	for (const ref of resolvedRefs) {
		const input = inputs.find((candidate) => candidate.itemId === ref.itemId);
		if (input?.consume) {
			yield* consumeResolvedInputRefFx({
				events,
				nextSave,
				reason: "craft-input-auto-fill",
				ref,
			});
		}
		yield* storeCraftResolvedInputFx({
			events,
			nextSave,
			nowMs,
			recipeId,
			targetItemInstanceId,
			ref,
		});
	}

	const storedInputs = yield* readCraftInputQuantitiesFx({
		save: nextSave,
		targetItemInstanceId,
	});
	return inputs.every(
		(input) =>
			readGameItemQuantity({
				itemId: input.itemId,
				quantities: storedInputs,
			}) >= input.quantity,
	);
});
