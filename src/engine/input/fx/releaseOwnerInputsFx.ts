import { Effect } from "effect";

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
}

/**
 * Detaches one board owner and relocates each direct buffered root through the
 * canonical existing-item placement path from the released owner position.
 *
 * Pure roots may normalize into ordinary stacks and identities. Impure roots
 * preserve their exact runtime identity, state, and passive owned subtree.
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
		return runtime;
	}
	if (!isBoardRuntimeItem(owner)) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
			}),
		);
	}

	let draft = {
		...runtime,
		items: runtime.items.filter((item) => item.id !== owner.id),
	} satisfies RuntimeSchema.Type;

	for (const bufferedItem of bufferedItems) {
		draft = yield* placeRuntimeItemFx({
			itemId: bufferedItem.id,
			origin: owner.location,
			runtime: draft,
		});
	}

	return draft;
});
