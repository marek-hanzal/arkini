import { Effect } from "effect";
import { writeStoredActivationInputQuantityFx } from "~/activation/writeStoredActivationInputQuantityFx";
import { pruneEmptyCraftInputStateFx } from "~/craft/pruneEmptyCraftInputStateFx";
import { readOrCreateCraftInputStateFx } from "~/craft/readOrCreateCraftInputStateFx";
import { writeCraftInputStateToSaveFx } from "~/craft/writeCraftInputStateToSaveFx";
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
	const craftInputState = yield* readOrCreateCraftInputStateFx({
		save: nextSave,
		targetItemInstanceId,
	});

	yield* writeStoredActivationInputQuantityFx({
		itemId,
		nextQuantity,
		state: craftInputState,
	});
	if (nextQuantity > 0 || Object.keys(craftInputState.items).length > 0) {
		yield* writeCraftInputStateToSaveFx({
			save: nextSave,
			state: craftInputState,
			targetItemInstanceId,
		});
		return;
	}

	yield* pruneEmptyCraftInputStateFx({
		save: nextSave,
		targetItemInstanceId,
	});
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
