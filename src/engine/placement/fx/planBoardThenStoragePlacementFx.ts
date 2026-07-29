import { Effect } from "effect";

import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

import { assertPlacementPlanCompleteFx } from "./assertPlacementPlanCompleteFx";
import { mergePlacementPlansFx } from "./mergePlacementPlansFx";
import { planBoardPlacementFx } from "./planBoardPlacementFx";
import { planInventoryPlacementFx } from "./planInventoryPlacementFx";
import { planToolbarPlacementFx } from "./planToolbarPlacementFx";
import { readPlacementPlanQuantityFx } from "./readPlacementPlanQuantityFx";
import type { BoardRectangleSchema } from "~/engine/grid/schema/BoardRectangleSchema";

export namespace planBoardThenStoragePlacementFx {
	export interface Props {
		drop: DropResultSchema.Type;
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		item: ItemSchema.Type;
		origin: BoardLocationSchema.Type;
		originRectangle?: BoardRectangleSchema.Type;
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
		originRectangle,
		quantity,
		runtime,
	}: planBoardThenStoragePlacementFx.Props) {
		const boardPlan = yield* planBoardPlacementFx({
			excludedLocations: excludedLocations?.filter(
				(location): location is BoardLocationSchema.Type => location.scope === "board",
			),
			item,
			origin,
			originRectangle,
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
			excludedLocations,
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
				reason: PlacementFailureReasonEnumSchema.enum.InventoryFull,
			});
		}

		const toolbarPlan = yield* planToolbarPlacementFx({
			excludedLocations,
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
			reason: PlacementFailureReasonEnumSchema.enum.ToolbarFull,
		});
	},
);
