import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { dropFx } from "~/production-output/fx/dropFx";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { mergePlacementPlansFn } from "~/engine/placement/fn/mergePlacementPlansFn";
import { readPlacementPlanQuantityFn } from "~/engine/placement/fn/readPlacementPlanQuantityFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planToolbarPlacementFx } from "./planToolbarPlacementFx";

export namespace planPassiveStoragePlacementFx {
	export interface Props {
		drop: dropFx.Result;
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		origin: Extract<
			GridLocationSchema.Type,
			{
				scope: "inventory" | "toolbar";
			}
		>;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans an `any` drop from passive storage without inventing a Board origin. */
export const planPassiveStoragePlacementFx = Effect.fn("planPassiveStoragePlacementFx")(function* ({
	drop,
	excludedLocations,
	item,
	origin,
	quantity,
	runtime,
}: planPassiveStoragePlacementFx.Props) {
	const first =
		origin.scope === "inventory"
			? yield* planInventoryPlacementFx({
					excludedLocations,
					item,
					origin: origin.position,
					quantity,
					runtime,
				})
			: yield* planToolbarPlacementFx({
					excludedLocations,
					item,
					origin: origin.position,
					quantity,
					runtime,
				});
	const firstQuantity = readPlacementPlanQuantityFn({
		plan: first,
	});
	const remainingQuantity = quantity - firstQuantity;
	if (remainingQuantity === 0) return first;

	const second =
		origin.scope === "inventory"
			? yield* planToolbarPlacementFx({
					excludedLocations,
					item,
					quantity: remainingQuantity,
					runtime,
				})
			: yield* planInventoryPlacementFx({
					excludedLocations,
					item,
					quantity: remainingQuantity,
					runtime,
				});
	const plan = mergePlacementPlansFn({
		plans: [
			first,
			second,
		],
	});
	return yield* assertPlacementPlanCompleteFx({
		drop,
		plan,
		quantity,
		reason:
			origin.scope === "inventory"
				? PlacementUnavailableError.Reason.ToolbarFull
				: PlacementUnavailableError.Reason.InventoryFull,
	});
});
