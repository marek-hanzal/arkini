import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";
import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import { readCraftRunState } from "~/v0/craft/logic/readCraftRunState";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";

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
				activation: "single" | "exhaust";
				boardItemId: string;
		  }
		| {
				type: "open-detail";
				boardItemId: string;
		  };
}

type ActivationView = NonNullable<BoardViewItem["activation"]>;

const activationRequirementReady = (requirement: ActivationView["requirements"][number]) => {
	if (requirement.type === "proximity") return requirement.satisfied;
	return requirement.stored >= requirement.quantity;
};

const activationRequirementsReady = (activation: ActivationView) =>
	activation.requirements.every(activationRequirementReady);

const activationInputsReady = (inputs: readonly ActivationInputView[]) =>
	inputs.every((input) => input.stored >= input.quantity);

const activationInputsFillable = (inputs: readonly ActivationInputView[]) =>
	inputs.some((input) => {
		const missingQuantity = input.quantity - input.stored;
		return missingQuantity > 0 && Math.min(missingQuantity, input.available ?? 0) > 0;
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
		const craftRunState = readCraftRunState({
			craft: liveCraft,
		});

		if (craftRunState.canRunAction) {
			return {
				type: "start-craft",
				boardItemId: boardItem.id,
				recipeId: liveCraft.id,
			};
		}

		return {
			type: "open-detail",
			boardItemId: boardItem.id,
		};
	}

	if (boardItem.activation?.kind === "stash") {
		if (
			activationRequirementsReady(boardItem.activation) &&
			(activationInputsReady(boardItem.activation.inputs) ||
				activationInputsFillable(boardItem.activation.inputs))
		) {
			return {
				type: "activate",
				activation: "exhaust",
				boardItemId: boardItem.id,
			};
		}

		return {
			type: "open-detail",
			boardItemId: boardItem.id,
		};
	}

	if (boardItem.activation?.kind === "producer") {
		const defaultLine = boardItem.activation.productLines?.find((line) => line.isDefault);
		const runState = defaultLine
			? readProducerProductLineRunState({
					line: defaultLine,
				})
			: undefined;
		if (runState?.canRunAction) {
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
