import { Effect } from "effect";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isInputRuntimeItem } from "~/engine/runtime/read/isInputRuntimeItem";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace releaseOwnerInputsFx {
	export interface Props {
		owner: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Detaches one board owner and returns every direct buffered root through the
 * canonical existing-item placement path with exact visible placement facts.
 */
export const releaseOwnerInputsFx = Effect.fn("releaseOwnerInputsFx")(function* ({
	owner,
	runtime,
}: releaseOwnerInputsFx.Props) {
	const bufferedItems = runtime.items.filter(
		(item): item is InputRuntimeItemSchema.Type =>
			isInputRuntimeItem(item) && item.location.ownerItemId === owner.id,
	);
	if (bufferedItems.length === 0) {
		return {
			events: [],
			runtime,
		} satisfies releaseOwnerInputsFx.Result;
	}
	if (!isBoardRuntimeItem(owner)) {
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
			origin: owner.location,
			runtime: state.runtime,
		});
		state = {
			events: [...state.events, ...placement.events],
			runtime: placement.runtime,
		};
	}

	return state;
});
