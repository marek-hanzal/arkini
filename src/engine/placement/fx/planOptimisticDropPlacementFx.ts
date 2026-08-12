import { Effect } from "effect";

import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { assertPlacementMaxCountFx } from "~/engine/placement/fx/assertPlacementMaxCountFx";
import { assertPlacementPlanCompleteFx } from "~/engine/placement/fx/assertPlacementPlanCompleteFx";
import { readOptimisticScopeLocationsFx } from "~/engine/placement/fx/readOptimisticScopeLocationsFx";
import type { planDropPlacementFx } from "~/engine/placement/fx/planDropPlacementFx";
import { planScopePlacementFx } from "~/engine/placement/fx/planScopePlacementFx";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import { StorageScopeEnumSchema } from "~/engine/scope/schema/StorageScopeEnumSchema";

/**
 * Plans schema-valid placement while treating physical grid capacity as unbounded.
 *
 * Scope, stacking, purity, maxCount and atomic quantity remain canonical. New
 * stacks receive deterministic virtual coordinates outside the currently claimed
 * geometry. These snapshots are planner-internal and must not be persisted through
 * the canonical runtime validator.
 */
export const planOptimisticDropPlacementFx = Effect.fn("planOptimisticDropPlacementFx")(function* ({
	drop,
	excludedLocations = [],
	origin,
	runtime,
}: planDropPlacementFx.Props) {
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	yield* assertPlacementMaxCountFx({
		drop,
		item,
		runtime,
	});

	const scope =
		item.scope === StorageScopeEnumSchema.enum.Any
			? LocationScopeEnumSchema.enum.Board
			: item.scope;
	const locations = yield* readOptimisticScopeLocationsFx({
		count: Math.ceil(drop.quantity / item.maxStackSize),
		excludedLocations,
		originSpace: origin.space,
		runtime,
		scope,
	});
	const plan = yield* planScopePlacementFx({
		excludedLocations: locations.excludedLocations,
		item,
		locations: [
			...locations.claimedLocations,
			...locations.virtualLocations,
		],
		origin: scope === LocationScopeEnumSchema.enum.Board ? origin.position : undefined,
		quantity: drop.quantity,
		runtime,
	});

	return yield* assertPlacementPlanCompleteFx({
		drop,
		plan,
		quantity: drop.quantity,
		reason:
			scope === LocationScopeEnumSchema.enum.Board
				? PlacementFailureReasonEnumSchema.enum.BoardFull
				: scope === LocationScopeEnumSchema.enum.Inventory
					? PlacementFailureReasonEnumSchema.enum.InventoryFull
					: PlacementFailureReasonEnumSchema.enum.ToolbarFull,
	});
});
