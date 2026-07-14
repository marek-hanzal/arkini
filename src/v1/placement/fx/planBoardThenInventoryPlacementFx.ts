import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { DropResultSchema } from "~/v1/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace planBoardThenInventoryPlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		origin: PositionSchema.Type;
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
			placement: drop.placement === "random" ? "random" : "drop",
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
			reason: "inventory:full",
		});
	},
);
