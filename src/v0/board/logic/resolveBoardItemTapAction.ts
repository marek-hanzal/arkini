import type { ActivationModeSchema } from "~/v0/activation/type/ActivationModeSchema";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";

export namespace resolveBoardItemTapAction {
	export interface Props {
		boardItem: BoardViewItem;
		nowMs: number;
	}

	export type Result =
		| {
				type: "claim-craft";
				boardItemId: string;
		  }
		| {
				type: "start-craft";
				boardItemId: string;
				recipeId: string;
		  }
		| {
				type: "activate";
				activation: ActivationModeSchema.Type;
				boardItemId: string;
		  }
		| {
				type: "open-detail";
				boardItemId: string;
		  };
}

const requirementReady = (requirement: ActivationRequirementView) => {
	if (requirement.type === "proximity") return requirement.satisfied;
	return requirement.stored >= requirement.quantity;
};

const requirementsReady = (requirements: readonly ActivationRequirementView[] | undefined) =>
	(requirements ?? []).every(requirementReady);

const productLineCanStart = (line: ProducerProductLineView) =>
	line.enabled &&
	!line.queueFull &&
	line.requirementsReady &&
	(line.inputsReady || line.inputsAvailable);

const craftInputFillable = (craft: NonNullable<BoardViewItem["craft"]>) =>
	craft.inputs.some((input) => {
		const delivered = craft.delivered[input.itemId] ?? 0;
		return delivered < input.quantity && (input.available ?? 0) > 0;
	});

export const resolveBoardItemTapAction = ({
	boardItem,
	nowMs,
}: resolveBoardItemTapAction.Props): resolveBoardItemTapAction.Result => {
	const liveCraft = readLiveCraftView({
		craft: boardItem.craft,
		nowMs,
	});

	if (liveCraft?.complete) {
		return {
			type: "claim-craft",
			boardItemId: boardItem.id,
		};
	}

	if (liveCraft?.phase === "collecting_inputs") {
		if (requirementsReady(liveCraft.requirements)) {
			const inputsReady = liveCraft.inputProgress >= 1;
			const inputsFillable = craftInputFillable(liveCraft);

			if (inputsReady || inputsFillable) {
				return {
					type: "start-craft",
					boardItemId: boardItem.id,
					recipeId: liveCraft.id,
				};
			}
		}

		return {
			type: "open-detail",
			boardItemId: boardItem.id,
		};
	}

	if (boardItem.activation?.kind === "stash") {
		return {
			type: "activate",
			activation: "exhaust",
			boardItemId: boardItem.id,
		};
	}

	if (boardItem.activation?.kind === "producer") {
		const defaultLine = boardItem.activation.productLines?.find((line) => line.isDefault);
		if (defaultLine && productLineCanStart(defaultLine)) {
			return {
				type: "activate",
				activation: "single",
				boardItemId: boardItem.id,
			};
		}
		return {
			type: "open-detail",
			boardItemId: boardItem.id,
		};
	}

	return {
		type: "open-detail",
		boardItemId: boardItem.id,
	};
};
