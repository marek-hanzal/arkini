import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFn } from "~/engine/item/fn/isItemPureFn";
import type { InventoryLocationSchema } from "~/item-location/schema/InventoryLocationSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { assertPlacementPlanCompleteFx } from "~/item-placement/fx/assertPlacementPlanCompleteFx";
import { planInventoryPlacementFx } from "~/item-placement/fx/planInventoryPlacementFx";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { readInventoryLocationsFn } from "~/item-placement/fn/readInventoryLocationsFn";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { PlacementPlan } from "~/item-placement/PlacementPlan";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export type InventoryStoragePlan =
	| {
			readonly kind: "pure";
			readonly detachedRuntime: RuntimeSchema.Type;
			readonly plan: PlacementPlan;
	  }
	| {
			readonly kind: "stateful";
			readonly location: InventoryLocationSchema.Type;
	  };

export namespace planInventoryStorageFx {
	export interface Props {
		readonly item: GridRuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Plans one whole live grid item into Inventory without mutating the runtime. */
export const planInventoryStorageFx = Effect.fn("planInventoryStorageFx")(function* ({
	item,
	runtime,
}: planInventoryStorageFx.Props) {
	const pure = isItemPureFn({
		item,
		runtime,
	});
	if (pure) {
		const detachedRuntime = {
			...runtime,
			items: runtime.items.filter((candidate) => candidate.id !== item.id),
		} satisfies RuntimeSchema.Type;
		const drop = {
			itemId: item.item.id,
			placement: PlacementSchema.enum.Drop,
			quantity: item.quantity,
		} as const;
		const partialPlan = yield* planInventoryPlacementFx({
			item: item.item,
			quantity: item.quantity,
			runtime: detachedRuntime,
		});
		const plan = yield* assertPlacementPlanCompleteFx({
			drop,
			plan: partialPlan,
			quantity: item.quantity,
			reason: PlacementUnavailableError.Reason.InventoryFull,
		});
		return {
			kind: "pure",
			detachedRuntime,
			plan,
		} satisfies InventoryStoragePlan;
	}

	if (item.quantity !== 1) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: item.id,
			}),
		);
	}
	const config = yield* GameConfigFx;
	const locations = readInventoryLocationsFn({
		size: config.meta.inventory,
	});
	const [location] = readEmptyLocationsFn({
		locations,
		runtime,
	});
	if (location === undefined) {
		return yield* Effect.fail(
			new PlacementUnavailableError({
				itemId: item.item.id,
				placement: PlacementSchema.enum.Drop,
				quantity: item.quantity,
				reason: PlacementUnavailableError.Reason.InventoryFull,
				remainingQuantity: item.quantity,
			}),
		);
	}
	return {
		kind: "stateful",
		location,
	} satisfies InventoryStoragePlan;
});
