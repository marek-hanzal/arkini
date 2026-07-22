import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { assertOwnerIdleFx } from "~/engine/job/fx/assertOwnerIdleFx";
import { applyPlacementPlanFx } from "~/engine/placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";
import { readRuntimeItemDropLocationFx } from "~/engine/placement/fx/readRuntimeItemDropLocationFx";
import { ItemJobScopedError } from "~/engine/runtime/error/ItemJobScopedError";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

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
	if (item.location.scope === LocationScopeEnumSchema.enum.Job) {
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
