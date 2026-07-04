import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { increaseStoredActivationInputQuantityFx } from "~/activation/writeStoredActivationInputQuantityFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace storeCraftResolvedInputFx {
	export interface Props {
		events: GameEvent[];
		nextSave: GameSave;
		nowMs: number;
		recipeId: string;
		ref: GameActionResolvedInputRef;
		targetItemInstanceId: string;
	}
}

export const storeCraftResolvedInputFx = Effect.fn("storeCraftResolvedInputFx")(function* ({
	events,
	nextSave,
	nowMs,
	recipeId,
	ref,
	targetItemInstanceId,
}: storeCraftResolvedInputFx.Props) {
	const craftInputState = (nextSave.craftInputs[targetItemInstanceId] ??= {
		items: {},
	});
	const { nextQuantity, previousQuantity } = yield* increaseStoredActivationInputQuantityFx({
		itemId: ref.itemId,
		quantity: ref.quantity,
		state: craftInputState,
	});

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

	return {
		nextQuantity,
		previousQuantity,
	};
});
