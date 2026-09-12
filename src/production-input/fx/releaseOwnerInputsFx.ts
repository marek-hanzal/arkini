import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { Effect, Option } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { placeRuntimeItemFx } from "~/item-placement/fx/placeRuntimeItemFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace releaseOwnerInputsFx {
	export interface Props {
		owner: RuntimeItemSchema.Type;
		origin?: BoardLocationSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Returns every direct buffered root from its explicit visible origin or Board owner through the
 * canonical existing-item placement path with exact visible placement facts.
 */
export const releaseOwnerInputsFx = Effect.fn("releaseOwnerInputsFx")(function* ({
	owner,
	origin,
	runtime,
}: releaseOwnerInputsFx.Props) {
	const bufferedItems = runtime.items.filter(
		(item): item is InputRuntimeItemSchema.Type =>
			item.location.scope === LocationScopeEnumSchema.enum.Input &&
			item.location.ownerItemId === owner.id,
	);
	if (bufferedItems.length === 0) {
		return {
			events: [],
			runtime,
		} satisfies releaseOwnerInputsFx.Result;
	}
	const boardOrigin = origin ?? Option.getOrUndefined(narrowBoardRuntimeItemFn(owner))?.location;
	if (boardOrigin === undefined) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
			}),
		);
	}

	let state: releaseOwnerInputsFx.Result = {
		events: [],
		runtime: {
			...runtime,
			items: runtime.items.filter((item) => item.id !== owner.id),
		},
	};

	for (const bufferedItem of bufferedItems) {
		const placement = yield* placeRuntimeItemFx({
			itemId: bufferedItem.id,
			origin: boardOrigin,
			originItemId: owner.id,
			runtime: state.runtime,
		});
		state = {
			events: [
				...state.events,
				...placement.events,
			],
			runtime: placement.runtime,
		};
	}

	return state;
});
