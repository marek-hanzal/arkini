import { match } from "ts-pattern";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";
import type {
	BoardCellDropAction,
	BoardItemToBoardItemActionInput,
} from "~/play/drop/BoardCellDropAction";
import { createBoardCellRejectDropAction } from "~/play/drop/createBoardCellDropActions";

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
			() => ({
				animation: "remove" as const,
				input,
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
				...(matchedPlan.consumesSource
					? {
							animation: "remove" as const,
						}
					: {}),
				feedback: {
					cellKey: targetCellKey,
					kind: "cell-feedback" as const,
					variant: matchedPlan.feedbackVariant,
				},
				input,
				type: "apply-board-item-to-board-item" as const,
			}),
		)
		.exhaustive();
