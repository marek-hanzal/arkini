import { Effect } from "effect";

import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { dropFx } from "~/engine/output/fx/dropFx";
import { mergePlacementPlansFn } from "~/engine/placement/fn/mergePlacementPlansFn";
import { readPlacementPlanQuantityFn } from "~/engine/placement/fn/readPlacementPlanQuantityFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planToolbarPlacementFx } from "./planToolbarPlacementFx";

export namespace planBoardThenStoragePlacementFx {
	export interface Props {
		drop: dropFx.Result;
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Plans board first, then inventory, then toolbar for an `any` item. */
export const planBoardThenStoragePlacementFx = Effect.fn("planBoardThenStoragePlacementFx")(
	function* ({
		drop,
		excludedLocations,
		item,
		origin,
		quantity,
		runtime,
	}: planBoardThenStoragePlacementFx.Props) {
		const boardPlan = yield* planBoardPlacementFx({
			excludedLocations: excludedLocations?.filter(
				(location): location is BoardLocationSchema.Type => location.scope === "board",
			),
			item,
			origin,
			placement: drop.placement,
			quantity,
			runtime,
		});
		const boardQuantity = readPlacementPlanQuantityFn({
			plan: boardPlan,
		});
		const inventoryQuantity = quantity - boardQuantity;
		if (inventoryQuantity === 0) return boardPlan;

		const inventoryPlan = yield* planInventoryPlacementFx({
			excludedLocations,
			item,
			quantity: inventoryQuantity,
			runtime,
		});
		const placedInventoryQuantity = readPlacementPlanQuantityFn({
			plan: inventoryPlan,
		});
		const toolbarQuantity = inventoryQuantity - placedInventoryQuantity;
		if (toolbarQuantity === 0) {
			return mergePlacementPlansFn({
				plans: [
					boardPlan,
					inventoryPlan,
				],
			});
		}

		const config = yield* GameConfigFx;
		if ((config.meta.toolbarSize ?? 0) === 0) {
			const plan = mergePlacementPlansFn({
				plans: [
					boardPlan,
					inventoryPlan,
				],
			});
			return yield* assertPlacementPlanCompleteFx({
				drop,
				plan,
				quantity,
				reason: PlacementUnavailableError.Reason.InventoryFull,
			});
		}

		const toolbarPlan = yield* planToolbarPlacementFx({
			excludedLocations,
			item,
			quantity: toolbarQuantity,
			runtime,
		});
		const plan = mergePlacementPlansFn({
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
			reason: PlacementUnavailableError.Reason.ToolbarFull,
		});
	},
);
