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
import { PlacementEnumSchema } from "~/engine/placement/schema/PlacementEnumSchema";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import type { PlacementPlanSchema } from "~/engine/placement/schema/PlacementPlanSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export type StoreItemInInventoryPlan =
	| {
			readonly kind: "pure";
			readonly detachedRuntime: RuntimeSchema.Type;
			readonly plan: PlacementPlanSchema.Type;
	  }
	| {
			readonly kind: "stateful";
			readonly location: InventoryLocationSchema.Type;
	  };

export namespace readStoreItemInInventoryPlanFx {
	export interface Props {
		readonly item: GridRuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Plans one whole live grid item into Inventory without mutating the runtime. */
export const readStoreItemInInventoryPlanFx = Effect.fn("readStoreItemInInventoryPlanFx")(
	function* ({ item, runtime }: readStoreItemInInventoryPlanFx.Props) {
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
				placement: PlacementEnumSchema.enum.Drop,
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
				reason: PlacementFailureReasonEnumSchema.enum.InventoryFull,
			});
			return {
				kind: "pure",
				detachedRuntime,
				plan,
			} satisfies StoreItemInInventoryPlan;
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
			item: item.item,
			locations,
			runtime,
		});
		if (location === undefined) {
			return yield* Effect.fail(
				new PlacementUnavailableError({
					itemId: item.item.id,
					placement: PlacementEnumSchema.enum.Drop,
					quantity: item.quantity,
					reason: PlacementFailureReasonEnumSchema.enum.InventoryFull,
					remainingQuantity: item.quantity,
				}),
			);
		}
		return {
			kind: "stateful",
			location,
		} satisfies StoreItemInInventoryPlan;
	},
);
