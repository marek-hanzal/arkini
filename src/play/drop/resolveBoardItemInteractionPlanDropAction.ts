import { match } from "ts-pattern";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";
import type {
	BoardCellDropAction,
	BoardItemToBoardItemActionInput,
} from "~/play/drop/BoardCellDropAction";
import { createBoardCellRejectDropAction } from "~/play/drop/createBoardCellDropActions";

const readConsumedSourceAnimation = ({
	input,
	plan,
}: {
	input: BoardItemToBoardItemActionInput;
	plan: Extract<
		ItemToBoardItemInteractionPlan,
		{
			consumedQuantity: number;
			consumesSource: boolean;
		}
	>;
}): "boomerang" | "remove" | undefined => {
	if (!plan.consumesSource) return undefined;
	return input.sourceQuantity > plan.consumedQuantity ? "boomerang" : "remove";
};

const attachConsumedQuantity = ({
	input,
	plan,
}: {
	input: BoardItemToBoardItemActionInput;
	plan: Extract<
		ItemToBoardItemInteractionPlan,
		{
			consumedQuantity: number;
		}
	>;
}): BoardItemToBoardItemActionInput => ({
	...input,
	consumedQuantity: plan.consumedQuantity,
});

export const resolveBoardItemInteractionPlanDropAction = ({
	input,
	plan,
	targetCellKey,
}: {
	input: BoardItemToBoardItemActionInput;
	plan: ItemToBoardItemInteractionPlan;
	targetCellKey: string;
}): BoardCellDropAction =>
	match(plan)
		.with(
			{
				type: "reject",
			},
			() => createBoardCellRejectDropAction(targetCellKey),
		)
		.with(
			{
				type: "swap",
			},
			() => ({
				animation: "parallel-swap" as const,
				input,
				type: "swap-board-items" as const,
			}),
		)
		.with(
			{
				type: "merge",
			},
			{
				type: "stack",
			},
			() => ({
				animation: "parallel-merge" as const,
				feedback: {
					kind: "merge-cell" as const,
					cellKey: targetCellKey,
				},
				input,
				type: "merge-board-items" as const,
			}),
		)
		.with(
			{
				type: "producer-input",
			},
			(matchedPlan) => ({
				animation: readConsumedSourceAnimation({
					input,
					plan: matchedPlan,
				}),
				input: attachConsumedQuantity({
					input,
					plan: matchedPlan,
				}),
				type: "apply-board-item-to-board-item" as const,
			}),
		)
		.with(
			{
				type: "craft-input",
			},
			{
				type: "stash-input",
			},
			{
				type: "tile-remove",
			},
			(matchedPlan) => ({
				...(readConsumedSourceAnimation({
					input,
					plan: matchedPlan,
				})
					? {
							animation: readConsumedSourceAnimation({
								input,
								plan: matchedPlan,
							}),
						}
					: {}),
				feedback: {
					cellKey: targetCellKey,
					kind: "cell-feedback" as const,
					variant: matchedPlan.feedbackVariant,
				},
				input: attachConsumedQuantity({
					input,
					plan: matchedPlan,
				}),
				type: "apply-board-item-to-board-item" as const,
			}),
		)
		.exhaustive();
