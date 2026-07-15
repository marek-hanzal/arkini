import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace isolateStatefulOwnerFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Keeps one state-owning board identity and standard-places every excess pure quantity.
 */
export const isolateStatefulOwnerFx = Effect.fn("isolateStatefulOwnerFx")(function* ({
	ownerItemId,
	runtime,
}: isolateStatefulOwnerFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	if (!isBoardRuntimeItem(owner)) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
			}),
		);
	}
	if (owner.quantity === 1) {
		return runtime;
	}

	const pure = yield* isItemPureFx({
		item: owner,
		runtime,
	});
	if (pure) {
		return yield* Effect.dieMessage(
			`Owner ${owner.id} must own identity-bound state before it can be isolated.`,
		);
	}

	const statefulOwner = yield* reviseRuntimeItemFx({
		item: {
			...owner,
			quantity: 1,
		},
	});
	const ownerRuntime = {
		...runtime,
		items: runtime.items.map((item) => (item.id === owner.id ? statefulOwner : item)),
	} satisfies RuntimeSchema.Type;
	const [, nextRuntime] = yield* applyOutputPlacementFx({
		origin: owner.location,
		output: {
			drop: [
				{
					itemId: owner.item.id,
					quantity: owner.quantity - 1,
					placement: "drop",
				},
			],
		},
		runtime: ownerRuntime,
	});

	return nextRuntime;
});
