import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { isBoardViewItemRuntimeBusy } from "~/board/view/isBoardViewItemRuntimeBusy";
import { isBoardViewItemRuntimeStatePreserved } from "~/board/view/isBoardViewItemRuntimeStatePreserved";
import { readBoardViewItemQuantity } from "~/board/view/readBoardViewItemQuantity";
import type { GameConfig } from "~/config/GameConfigTypes";
import type {
	GameDebugExplanation,
	GameDebugExplanationStep,
} from "~/debug/explain/GameDebugExplanation";
import { readGameDebugExplanationOutcome } from "~/debug/explain/readGameDebugExplanationOutcome";
import { resolveExecutableItemMergeRule } from "~/merge/resolveExecutableItemMergeRule";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";

export namespace explainItemToBoardItemDrop {
	export interface Props {
		config: GameConfig;
		sourceItemId: string;
		sourceKind?: "board" | "inventory";
		sourceQuantity?: number;
		targetItem: BoardViewItem;
	}
}

const readSourceQuantity = ({
	sourceQuantity,
}: Pick<explainItemToBoardItemDrop.Props, "sourceQuantity">) => sourceQuantity ?? 1;

const createInputFactsSteps = ({
	sourceItemId,
	targetItem,
}: Pick<
	explainItemToBoardItemDrop.Props,
	"sourceItemId" | "targetItem"
>): GameDebugExplanationStep[] => {
	const steps: GameDebugExplanationStep[] = [];
	if (targetItem.craft) {
		const input = targetItem.craft.inputs.find((entry) => entry.itemId === sourceItemId);
		const deliveredQuantity = targetItem.craft.delivered[sourceItemId] ?? 0;
		steps.push(
			input
				? {
						code: "craft_input_fact",
						details: {
							capacity: input.quantity,
							deliveredQuantity,
							sourceItemId,
						},
						message: "Craft target has a matching input slot.",
						status: "info",
					}
				: {
						code: "craft_input_missing",
						details: {
							sourceItemId,
						},
						message: "Craft target does not list this source item as an input.",
						status: "info",
					},
		);
	}

	for (const line of targetItem.activation?.lines ?? []) {
		const input = line.inputs.find((entry) => entry.itemId === sourceItemId);
		if (!input) continue;
		steps.push({
			code: "producer_input_fact",
			details: {
				capacity: input.capacity,
				lineId: line.lineId,
				sourceItemId,
				storedQuantity: input.stored,
			},
			message: "Producer or stash line has a matching input slot.",
			status: "info",
		});
	}

	if (targetItem.activation?.kind === "stash") {
		const input = targetItem.activation.inputs.find((entry) => entry.itemId === sourceItemId);
		steps.push(
			input
				? {
						code: "stash_input_fact",
						details: {
							capacity: input.capacity,
							sourceItemId,
							storedQuantity: input.stored,
						},
						message: "Stash target has a matching input slot.",
						status: "info",
					}
				: {
						code: "stash_input_missing",
						details: {
							sourceItemId,
						},
						message: "Stash target does not list this source item as an input.",
						status: "info",
					},
		);
	}

	return steps;
};

const createTargetStateSteps = ({
	targetItem,
}: Pick<explainItemToBoardItemDrop.Props, "targetItem">): GameDebugExplanationStep[] => {
	const steps: GameDebugExplanationStep[] = [];
	if (isBoardViewItemRuntimeBusy(targetItem)) {
		steps.push({
			code: "target_runtime_busy",
			message: "Target currently has a running runtime action.",
			status: "warning",
		});
	}
	if (isBoardViewItemRuntimeStatePreserved(targetItem)) {
		steps.push({
			code: "target_runtime_state_preserved",
			message: "Target has runtime state that blocks destructive replacement actions.",
			status: "warning",
		});
	}
	return steps;
};

const createPlanStep = ({
	config,
	props,
}: {
	config: GameConfig;
	props: explainItemToBoardItemDrop.Props;
}): GameDebugExplanationStep => {
	const plan = resolveItemToBoardItemInteractionPlan(props);
	const sourceKind = props.sourceKind ?? "board";

	switch (plan.type) {
		case "stack": {
			const maxStackSize = config.items[props.targetItem.itemId]?.maxStackSize ?? 1;
			return {
				code: "accepted_stack",
				details: {
					availableQuantity: readSourceQuantity(props),
					maxStackSize,
					targetQuantity: readBoardViewItemQuantity(props.targetItem),
				},
				message: "Drop will stack into the target item.",
				status: "accepted",
			};
		}
		case "merge":
			return {
				code: "accepted_merge",
				details: {
					resultItemId: plan.resultItemId,
				},
				message: "Drop matches an executable merge rule.",
				status: "accepted",
			};
		case "craft-input":
			return {
				code: "accepted_craft_input",
				details: {
					acceptedQuantity: plan.consumedQuantity,
				},
				message: "Drop will store the source item into the craft input slot.",
				status: "accepted",
			};
		case "producer-input":
			return {
				code: "accepted_producer_input",
				details: {
					acceptedQuantity: plan.consumedQuantity,
					lineId: plan.lineId,
				},
				message: "Drop will store the source item into a producer line input slot.",
				status: "accepted",
			};
		case "stash-input":
			return {
				code: "accepted_stash_input",
				details: {
					acceptedQuantity: plan.consumedQuantity,
				},
				message: "Drop will store the source item into the stash input slot.",
				status: "accepted",
			};
		case "tile-remove":
			return {
				code: "accepted_tile_remove",
				details: {
					acceptedQuantity: plan.consumedQuantity,
					consumesSource: plan.consumesSource,
				},
				message: "Drop will apply the configured tile removal rule.",
				status: "accepted",
			};
		case "swap":
			return sourceKind === "board"
				? {
						code: "accepted_board_swap",
						message:
							"No special interaction matched, so board-to-board drop will swap items.",
						status: "accepted",
					}
				: {
						code: "blocked_inventory_occupied_cell",
						message:
							"No special interaction matched, so inventory-to-occupied-board drop is blocked.",
						status: "blocked",
					};
		case "reject":
			return {
				code: "blocked_rejected_plan",
				message: "Interaction planner rejected the drop.",
				status: "blocked",
			};
	}
};

export const explainItemToBoardItemDrop = (
	props: explainItemToBoardItemDrop.Props,
): GameDebugExplanation<"item-to-board-item-drop"> => {
	const mergeRule = resolveExecutableItemMergeRule({
		config: props.config,
		sourceItemId: props.sourceItemId,
		targetItemId: props.targetItem.itemId,
	});
	const steps: GameDebugExplanationStep[] = [
		{
			code: "drop_context",
			details: {
				sourceItemId: props.sourceItemId,
				sourceKind: props.sourceKind ?? "board",
				sourceQuantity: readSourceQuantity(props),
				targetItemId: props.targetItem.itemId,
			},
			message: "Explaining item-to-board-item drop.",
			status: "info",
		},
		...createTargetStateSteps(props),
		...(mergeRule
			? [
					{
						code: "merge_rule_fact",
						details: {
							resultItemId:
								mergeRule.merge && "resultItemId" in mergeRule.merge
									? mergeRule.merge.resultItemId
									: undefined,
						},
						message:
							"Config contains an executable merge rule for this source and target.",
						status: "info" as const,
					},
				]
			: []),
		...createInputFactsSteps(props),
		createPlanStep({
			config: props.config,
			props,
		}),
	];

	return {
		kind: "item-to-board-item-drop",
		outcome: readGameDebugExplanationOutcome(steps),
		steps,
	};
};
