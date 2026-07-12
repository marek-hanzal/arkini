import { Effect } from "effect";

import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { assertPlacementMaxCountFx } from "~/v1/placement/fx/assertPlacementMaxCountFx";
import { assertPlacementPlanCompleteFx } from "~/v1/placement/fx/assertPlacementPlanCompleteFx";
import { planDropPlacementFx } from "~/v1/placement/fx/planDropPlacementFx";
import { planInventoryPlacementFx } from "~/v1/placement/fx/planInventoryPlacementFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import { isInputRuntimeItem } from "~/v1/runtime/read/isInputRuntimeItem";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace releaseOwnerInputsFx {
	export interface Props {
		owner: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

const planBufferedReleaseFx = Effect.fn("planBufferedReleaseFx")(function* ({
	bufferedItem,
	owner,
	runtime,
}: {
	bufferedItem: InputRuntimeItemSchema.Type;
	owner: RuntimeItemSchema.Type;
	runtime: RuntimeSchema.Type;
}) {
	const drop = {
		itemId: bufferedItem.item.id,
		placement: "drop" as const,
		quantity: bufferedItem.quantity,
	};
	const boardOrigin = isBoardRuntimeItem(owner)
		? owner.location.position
		: bufferedItem.location.returnLocation.scope === "board"
			? bufferedItem.location.returnLocation.position
			: undefined;
	if (boardOrigin !== undefined) {
		return yield* planDropPlacementFx({
			drop,
			origin: boardOrigin,
			originItemId: owner.id,
			runtime,
		});
	}

	yield* assertPlacementMaxCountFx({
		drop,
		item: bufferedItem.item,
		runtime,
	});
	const plan = yield* planInventoryPlacementFx({
		item: bufferedItem.item,
		quantity: bufferedItem.quantity,
		runtime,
	});
	return yield* assertPlacementPlanCompleteFx({
		drop,
		plan,
		quantity: bufferedItem.quantity,
		reason: "inventory:full",
	});
});

/**
 * Removes every buffered input owned by one idle item and re-emits it through
 * ordinary scope-aware placement over one evolving runtime draft.
 *
 * A board owner drops from its current board position. An inventory owner uses
 * each buffered material's last real grid scope without treating inventory
 * coordinates as board coordinates.
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

	let draft = {
		...runtime,
		items: runtime.items.filter(
			(item) =>
				item.id !== owner.id &&
				!(isInputRuntimeItem(item) && item.location.ownerItemId === owner.id),
		),
	} satisfies RuntimeSchema.Type;

	for (const bufferedItem of bufferedItems) {
		const plan = yield* planBufferedReleaseFx({
			bufferedItem,
			owner,
			runtime: draft,
		});
		const [, nextDraft] = yield* applyPlacementPlanFx({
			plan,
			runtime: draft,
		});
		draft = nextDraft;
	}

	return draft;
});
