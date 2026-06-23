import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";

export namespace storeStashResolvedInput {
	export interface Props {
		events: GameEvent[];
		nextSave: GameSave;
		nowMs: number;
		ref: GameActionResolvedInputRef;
		stashId: string;
		stashItemInstanceId: string;
	}
}

export const storeStashResolvedInput = ({
	events,
	nextSave,
	nowMs,
	ref,
	stashId,
	stashItemInstanceId,
}: storeStashResolvedInput.Props) => {
	const stashInputState = (nextSave.stashInputs[stashItemInstanceId] ??= {
		items: {},
	});
	const previousQuantity = stashInputState.items[ref.itemId] ?? 0;
	const nextQuantity = previousQuantity + ref.quantity;
	stashInputState.items[ref.itemId] = nextQuantity;

	events.push({
		itemId: ref.itemId,
		nextQuantity,
		previousQuantity,
		quantity: ref.quantity,
		stashId,
		stashItemInstanceId,
		storedAtMs: nowMs,
		type: "stash_input.stored",
	});
};
