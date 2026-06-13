import { Effect } from "effect";
import type { ArkiniTransaction } from "~/database/local/db";
import type { InventoryPlacementPlan } from "~/inventory/logic/planning";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";

export namespace applyInventoryPlacementPlanFx {
	export interface Props {
		tx: ArkiniTransaction;
		plan: readonly InventoryPlacementPlan[];
	}
}

export const applyInventoryPlacementPlanFx = Effect.fn("applyInventoryPlacementPlanFx")(function* ({
	tx,
	plan,
}: applyInventoryPlacementPlanFx.Props) {
	yield* applyPlacementPlanFx({
		tx,
		plan: {
			board: [],
			inventory: [
				...plan,
			],
		},
	});
});
