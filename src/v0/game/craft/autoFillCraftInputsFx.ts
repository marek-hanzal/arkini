import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { readCraftInputQuantitiesFx } from "~/v0/game/craft/readCraftInputQuantitiesFx";
import { planCraftAutoFillInputRefsFx } from "~/v0/game/craft/planCraftAutoFillInputRefsFx";
import { consumeResolvedInputRefFx } from "~/v0/game/requirements/consumeResolvedInputRefFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import { readGameItemQuantity } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace autoFillCraftInputsFx {
	export interface Props {
		events: GameEvent[];
		inputs: readonly GameConfig["craftRecipes"][string]["inputs"][number][];
		nextSave: GameSave;
		nowMs: number;
		recipeId: string;
		targetItemInstanceId: string;
	}
}

const storeCraftResolvedInput = ({
	events,
	nextSave,
	nowMs,
	recipeId,
	targetItemInstanceId,
	ref,
}: {
	events: GameEvent[];
	nextSave: GameSave;
	nowMs: number;
	recipeId: string;
	targetItemInstanceId: string;
	ref: GameActionResolvedInputRef;
}) => {
	const craftInputState = (nextSave.craftInputs[targetItemInstanceId] ??= {
		items: {},
	});
	const previousQuantity = craftInputState.items[ref.itemId] ?? 0;
	const nextQuantity = previousQuantity + ref.quantity;
	craftInputState.items[ref.itemId] = nextQuantity;

	events.push({
		itemId: ref.itemId,
		nextQuantity,
		previousQuantity,
		quantity: ref.quantity,
		recipeId,
		atMs: nowMs,
		targetItemInstanceId,
		type: "craft_input.stored",
	});
};

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
		yield* consumeResolvedInputRefFx({
			events,
			nextSave,
			reason: "craft-input-auto-fill",
			ref,
		});
		storeCraftResolvedInput({
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
