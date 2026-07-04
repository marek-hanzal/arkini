import { Effect } from "effect";

interface StoredActivationInputQuantityState {
	items: Record<string, number>;
}

export namespace increaseStoredActivationInputQuantityFx {
	export interface Props {
		itemId: string;
		quantity: number;
		state: StoredActivationInputQuantityState;
	}
}

export const increaseStoredActivationInputQuantityFx = Effect.fn(
	"increaseStoredActivationInputQuantityFx",
)(function* ({ itemId, quantity, state }: increaseStoredActivationInputQuantityFx.Props) {
	const previousQuantity = state.items[itemId] ?? 0;
	const nextQuantity = previousQuantity + quantity;
	state.items[itemId] = nextQuantity;

	return {
		nextQuantity,
		previousQuantity,
	};
});

export namespace writeStoredActivationInputQuantityFx {
	export interface Props {
		itemId: string;
		nextQuantity: number;
		state: StoredActivationInputQuantityState;
	}
}

export const writeStoredActivationInputQuantityFx = Effect.fn(
	"writeStoredActivationInputQuantityFx",
)(function* ({ itemId, nextQuantity, state }: writeStoredActivationInputQuantityFx.Props) {
	const previousQuantity = state.items[itemId] ?? 0;
	if (nextQuantity > 0) {
		state.items[itemId] = nextQuantity;
	} else {
		delete state.items[itemId];
	}

	return {
		nextQuantity,
		previousQuantity,
	};
});
