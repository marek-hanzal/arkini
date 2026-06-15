import { Effect } from "effect";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import type { InventoryPlacementPlan } from "~/v0/inventory/logic/planning/types";
import { defaultSaveGameId } from "~/v0/play/save";

export namespace applyInventoryPlacementPlanFx {
	export interface Props {
		plan: InventoryPlacementPlan[];
	}
}

export const applyInventoryPlacementPlanFx = Effect.fn("applyInventoryPlacementPlanFx")(function* ({
	plan,
}: applyInventoryPlacementPlanFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	for (const placement of plan) {
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
			continue;
		}

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
});
