import { Effect } from "effect";
import { insertFx } from "~/board/fx/insertFx";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import type { PlacementPlan } from "~/inventory/logic/planning";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { ProducerPlacement } from "~/play/logic/playTypes";
import { defaultSaveGameId } from "~/play/logic/save";

export namespace applyPlacementPlanFx {
	export interface Props {
		plan: PlacementPlan;
	}
}

export const applyPlacementPlanFx = Effect.fn("applyPlacementPlanFx")(function* ({
	plan,
}: applyPlacementPlanFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	const placements: ProducerPlacement[] = [];

	for (const placement of plan.board) {
		const boardItemId = yield* insertFx({
			itemId: placement.itemId,
			x: placement.x,
			y: placement.y,
		});
		placements.push({
			kind: "board",
			itemId: placement.itemId,
			boardItemId,
			x: placement.x,
			y: placement.y,
		});
	}

	for (const placement of plan.inventory) {
		if (placement.type === "update") {
			yield* dbFx((db) =>
				db
					.updateTable(table.inventoryStack)
					.set({
						quantity: placement.quantity,
						stateJson: placement.stateJson,
						updatedAt: timestamp,
					})
					.where("id", "=", placement.stackId)
					.execute(),
			);
		} else {
			yield* dbFx((db) =>
				db
					.insertInto(table.inventoryStack)
					.values({
						id: placement.stackId,
						saveGameId: defaultSaveGameId,
						slotIndex: placement.slotIndex,
						itemDefinitionId: placement.itemId,
						quantity: placement.quantity,
						stateJson: placement.stateJson,
					})
					.execute(),
			);
		}
		placements.push({
			kind: "inventory",
			itemId: placement.itemId,
			slotIndex: placement.slotIndex,
		});
	}

	return placements;
});
