import { Effect } from "effect";
import { insertBoardItemFx } from "~/v0/board/fx/insertBoardItemFx";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { PlacementPlan } from "~/inventory/logic/planning/types";
import { defaultSaveGameId } from "~/v0/play/save";
import type { ActivationPlacementSchema } from "~/activation/type/ActivationPlacementSchema";

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

	const placements: ActivationPlacementSchema.Type[] = [];

	for (const placement of plan.board) {
		const boardItemId = yield* insertBoardItemFx({
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
					.updateTable("itemInstance")
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
					.insertInto("itemInstance")
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
