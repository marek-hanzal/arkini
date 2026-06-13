import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import type { InventoryPlacementPlan } from "~/inventory/logic/planning";
import { DateServiceFx } from "~/date/context/DateServiceFx";
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
					.updateTable(table.inventoryStack)
					.set({
						quantity: placement.quantity,
						updatedAt: timestamp,
					})
					.where("id", "=", placement.stackId)
					.execute(),
			);
			continue;
		}

		yield* dbFx((db) =>
			db
				.insertInto(table.inventoryStack)
				.values({
					id: placement.stackId,
					saveGameId: defaultSaveGameId,
					slotIndex: placement.slotIndex,
					itemDefinitionId: placement.itemId,
					quantity: placement.quantity,
				})
				.execute(),
		);
	}
});
