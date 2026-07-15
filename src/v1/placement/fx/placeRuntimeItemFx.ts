import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { BoardLocationSchema } from "~/v1/location/schema/BoardLocationSchema";
import { ItemStatefulError } from "~/v1/item/error/ItemStatefulError";
import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import { assertOwnerIdleFx } from "~/v1/job/fx/assertOwnerIdleFx";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/v1/placement/fx/planDropPlacementFx";
import { readRuntimeItemDropLocationFx } from "~/v1/placement/fx/readRuntimeItemDropLocationFx";
import { ItemJobScopedError } from "~/v1/runtime/error/ItemJobScopedError";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace placeRuntimeItemFx {
	export interface Props {
		itemId: IdSchema.Type;
		origin: BoardLocationSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Sole lifecycle entry for placing one existing non-job item through the
 * canonical drop policy.
 *
 * Pure items may normalize into ordinary stacks and identities. Impure items
 * preserve their exact runtime identity and receive one exclusive grid cell.
 */
export const placeRuntimeItemFx = Effect.fn("placeRuntimeItemFx")(function* ({
	itemId,
	origin,
	runtime,
}: placeRuntimeItemFx.Props) {
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	if (item.location.scope === "job") {
		return yield* Effect.fail(
			new ItemJobScopedError({
				itemId: item.id,
				jobId: item.location.jobId,
			}),
		);
	}
	yield* assertOwnerIdleFx({
		ownerItemId: item.id,
		runtime,
	});
	const pure = yield* isItemPureFx({
		item,
		runtime,
	});
	const detachedRuntime = {
		...runtime,
		items: runtime.items.filter((candidate) => candidate.id !== item.id),
	} satisfies RuntimeSchema.Type;

	if (pure) {
		const plan = yield* planDropPlacementFx({
			drop: {
				itemId: item.item.id,
				placement: "drop",
				quantity: item.quantity,
			},
			origin,
			runtime: detachedRuntime,
		});
		const [, placedRuntime] = yield* applyPlacementPlanFx({
			plan,
			runtime: detachedRuntime,
		});
		return placedRuntime;
	}

	if (item.quantity !== 1) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: item.id,
			}),
		);
	}
	const location = yield* readRuntimeItemDropLocationFx({
		item,
		origin,
		runtime: detachedRuntime,
	});
	const placedItem = yield* reviseRuntimeItemFx({
		item: {
			...item,
			location,
		} satisfies GridRuntimeItemSchema.Type,
	});

	return {
		...runtime,
		items: runtime.items.map((candidate) => {
			return candidate.id === item.id ? placedItem : candidate;
		}),
	} satisfies RuntimeSchema.Type;
});
