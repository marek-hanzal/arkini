import { Effect } from "effect";
import { insertFx } from "~/board/logic/fx/insertFx";
import type { ArkiniTransaction } from "~/database/local/db";
import { table } from "~/database/local/tables";
import type { PlacementPlan } from "~/inventory/logic/planning";
import { localTimestamp } from "~/play/logic/localTimestamp";
import type { ProducerPlacement } from "~/play/logic/playTypes";
import { defaultSaveGameId } from "~/play/logic/save";
import { tryGameActionFx } from "./tryGameActionFx";

export namespace applyPlacementPlanFx {
	export interface Props {
		tx: ArkiniTransaction;
		plan: PlacementPlan;
	}
}

export const applyPlacementPlanFx = Effect.fn("applyPlacementPlanFx")(function* ({
	tx,
	plan,
}: applyPlacementPlanFx.Props) {
	const placements: ProducerPlacement[] = [];

	for (const placement of plan.board) {
		const boardItemId = yield* insertFx({
			tx,
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
			yield* tryGameActionFx(() =>
				tx
					.updateTable(table.inventoryStack)
					.set({
						quantity: placement.quantity,
						updatedAt: localTimestamp(),
					})
					.where("id", "=", placement.stackId)
					.execute(),
			);
		} else {
			yield* tryGameActionFx(() =>
				tx
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
		placements.push({
			kind: "inventory",
			itemId: placement.itemId,
			slotIndex: placement.slotIndex,
		});
	}

	return placements;
});
