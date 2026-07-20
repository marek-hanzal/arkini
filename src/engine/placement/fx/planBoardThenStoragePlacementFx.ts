import { Effect } from "effect";

import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planToolbarPlacementFx } from "./planToolbarPlacementFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";

export namespace planBoardThenStoragePlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans board first, then inventory, then toolbar for an `any` item. */
export const planBoardThenStoragePlacementFx = Effect.fn("planBoardThenStoragePlacementFx")(
	function* ({ drop, item, origin, quantity, runtime }: planBoardThenStoragePlacementFx.Props) {
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
		const inventoryQuantity = quantity - boardQuantity;
		if (inventoryQuantity === 0) return boardPlan;

		const inventoryPlan = yield* planInventoryPlacementFx({
			item,
			quantity: inventoryQuantity,
			runtime,
		});
		const placedInventoryQuantity = yield* readPlacementPlanQuantityFx({
			plan: inventoryPlan,
		});
		const toolbarQuantity = inventoryQuantity - placedInventoryQuantity;
		if (toolbarQuantity === 0) {
			return yield* mergePlacementPlansFx({
				plans: [
					boardPlan,
					inventoryPlan,
				],
			});
		}

		const config = yield* GameConfigFx;
		if ((config.meta.toolbarSize ?? 0) === 0) {
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
		}

		const toolbarPlan = yield* planToolbarPlacementFx({
			item,
			quantity: toolbarQuantity,
			runtime,
		});
		const plan = yield* mergePlacementPlansFx({
			plans: [
				boardPlan,
				inventoryPlan,
				toolbarPlan,
			],
		});
		return yield* assertPlacementPlanCompleteFx({
			drop,
			plan,
			quantity,
			reason: "toolbar:full",
		});
	},
);
