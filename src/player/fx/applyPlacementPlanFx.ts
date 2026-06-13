import { Effect } from "effect";
import { dbFx } from "~/database/fx/dbFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import type { PlayerInventoryPlacementPlan } from "~/player/logic/planning";
import { defaultSaveGameId } from "~/play/logic/save";

export namespace applyPlacementPlanFx {
	export interface Props {
		plan: readonly PlayerInventoryPlacementPlan[];
	}
}

export const applyPlacementPlanFx = Effect.fn("applyPlacementPlanFx")(function* ({
	plan,
}: applyPlacementPlanFx.Props) {
	const date = yield* DateServiceFx;
	const timestamp = date.timestamp();

	for (const placement of plan) {
		if (placement.type === "update") {
			yield* dbFx((db) =>
				db
					.updateTable(table.playerInventoryStack)
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
				.insertInto(table.playerInventoryStack)
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
