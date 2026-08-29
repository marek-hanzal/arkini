import { Effect } from "effect";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import type { InventoryLocationSchema } from "~/engine/location/schema/InventoryLocationSchema";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { assertPlacementPlanCompleteFx } from "~/engine/placement/fx/assertPlacementPlanCompleteFx";
import { planInventoryPlacementFx } from "~/engine/placement/fx/planInventoryPlacementFx";
import { readEmptyLocationsFx } from "~/engine/placement/fx/readEmptyLocationsFx";
import { readInventoryLocationsFx } from "~/engine/placement/fx/readInventoryLocationsFx";
import { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import type { PlacementPlan } from "~/engine/placement/PlacementPlan";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const pure = yield* isItemPureFx({
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
	const locations = yield* readInventoryLocationsFx({
		size: config.meta.inventory,
	});
	const [location] = yield* readEmptyLocationsFx({
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
