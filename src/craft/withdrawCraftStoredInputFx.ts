import { Effect } from "effect";
import { writeStoredActivationInputQuantityFx } from "~/activation/writeStoredActivationInputQuantityFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace withdrawCraftStoredInputFx {
	export interface Props {
		events: GameEvent[];
		itemId: string;
		nextQuantity: number;
		nextSave: GameSave;
		nowMs: number;
		previousQuantity: number;
		quantity: number;
		recipeId: string;
		targetItemInstanceId: string;
	}
}

const removeCraftInputQuantityFx = Effect.fn(
	"withdrawCraftStoredInputFx.removeCraftInputQuantityFx",
)(function* ({
	itemId,
	nextQuantity,
	nextSave,
	targetItemInstanceId,
}: withdrawCraftStoredInputFx.Props) {
	const craftInputState = nextSave.craftInputs[targetItemInstanceId] ?? {
		items: {},
	};

	yield* writeStoredActivationInputQuantityFx({
		itemId,
		nextQuantity,
		state: craftInputState,
	});
	if (nextQuantity > 0) {
		nextSave.craftInputs[targetItemInstanceId] = craftInputState;
		return;
	}

	if (Object.keys(craftInputState.items).length > 0) {
		nextSave.craftInputs[targetItemInstanceId] = craftInputState;
		return;
	}

	delete nextSave.craftInputs[targetItemInstanceId];
});

const appendCraftInputWithdrawnEventFx = Effect.fn(
	"withdrawCraftStoredInputFx.appendCraftInputWithdrawnEventFx",
)(function* ({
	events,
	itemId,
	nextQuantity,
	nowMs,
	previousQuantity,
	quantity,
	recipeId,
	targetItemInstanceId,
}: withdrawCraftStoredInputFx.Props) {
	events.push({
		itemId,
		nextQuantity,
		previousQuantity,
		quantity,
		recipeId,
		targetItemInstanceId,
		type: "craft_input.withdrawn",
		atMs: nowMs,
	});
});

export const withdrawCraftStoredInputFx = Effect.fn("withdrawCraftStoredInputFx")(function* (
	props: withdrawCraftStoredInputFx.Props,
) {
	yield* removeCraftInputQuantityFx(props);
	yield* appendCraftInputWithdrawnEventFx(props);
});
