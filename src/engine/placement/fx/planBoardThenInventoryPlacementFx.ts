import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";

import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace planBoardThenInventoryPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans board placement first and sends only its remainder to inventory. */
export const planBoardThenInventoryPlacementFx = Effect.fn("planBoardThenInventoryPlacementFx")(
	function* ({ drop, item, origin, quantity, runtime }: planBoardThenInventoryPlacementFx.Props) {
		const boardPlan = yield* planBoardPlacementFx({
			item,
			origin,
			placement: drop.placement,
			quantity,
			runtime,
		});
		const boardQuantity = yield* readPlacementPlanQuantityFx({
			plan: boardPlan,
		});
		const remainingQuantity = quantity - boardQuantity;
		if (remainingQuantity === 0) {
			return boardPlan;
		}

		const inventoryPlan = yield* planInventoryPlacementFx({
			item,
			quantity: remainingQuantity,
			runtime,
		});
		const plan = yield* mergePlacementPlansFx({
			plans: [
				boardPlan,
				inventoryPlan,
			],
		});

		return yield* assertPlacementPlanCompleteFx({
			drop,
			plan,
			quantity,
			reason: PlacementFailureReasonEnumSchema.enum.InventoryFull,
		});
	},
);
