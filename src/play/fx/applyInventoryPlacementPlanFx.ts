import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { InventoryPlacementPlan } from "~/inventory/logic/planning/types";
import { defaultSaveGameId } from "~/play/logic/save";

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
					.updateTable(table.itemInstance)
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
});
