import type { GameActionItemRef } from "~/action/GameActionItemRefSchema";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";

const withSourceQuantity = ({
	quantity,
	sourceRef,
}: {
	quantity: number;
	sourceRef: GameActionItemRef;
}): GameActionItemRef => ({
	...sourceRef,
	quantity,
});

export const readItemInteractionSourceRef = ({
	plan,
	sourceRef,
}: {
	plan: ItemToBoardItemInteractionPlan;
	sourceRef: GameActionItemRef;
}): GameActionItemRef => {
	if (!("consumedQuantity" in plan) || !plan.consumesSource) return sourceRef;

	return withSourceQuantity({
		quantity: plan.consumedQuantity,
		sourceRef,
	});
};
