import { Effect } from "effect";
import { insertFx } from "~/board/fx/insertFx";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { PlacementPlan } from "~/inventory/logic/planning/types";
import { defaultSaveGameId } from "~/play/logic/save";
import type { ProducerPlacement } from "~/producer/type/ProducerPlacementSchema";

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
					.updateTable(table.itemInstance)
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
					.insertInto(table.itemInstance)
					.values({
						id: placement.stackId,
						saveGameId: defaultSaveGameId,
						itemDefinitionId: placement.itemId,
						quantity: placement.quantity,
						locationKind: "inventory",
						boardX: null,
						boardY: null,
						inventorySlotIndex: placement.slotIndex,
						ownerItemInstanceId: null,
						inputItemDefinitionId: null,
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
