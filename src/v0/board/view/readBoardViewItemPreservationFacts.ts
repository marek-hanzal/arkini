import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";

const hasCraftInputState = (craft: BoardViewItem["craft"]) =>
	Boolean(craft && Object.values(craft.delivered).some((quantity) => quantity > 0));

const hasProducerStoredInputState = (activation: BoardViewItem["activation"]) =>
	Boolean(
		activation?.lines?.some((line) => line.inputs.some((input) => input.stored > 0)) ||
			activation?.inputs.some((input) => input.stored > 0),
	);

const hasProducerChargeState = (activation: BoardViewItem["activation"]) =>
	activation?.remainingCharges !== undefined;

const hasProducerLineControlState = (activation: BoardViewItem["activation"]) =>
	Boolean(activation?.lines?.some((line) => line.isDefault));

export type BoardViewItemPreservationFacts = {
	hasControlState: boolean;
	hasRuntimeState: boolean;
	requiresInstancePreservation: boolean;
};

export const readBoardViewItemPreservationFacts = (
	boardItem: BoardViewItem,
): BoardViewItemPreservationFacts => {
	const hasRuntimeState =
		hasCraftInputState(boardItem.craft) ||
		hasProducerChargeState(boardItem.activation) ||
		hasProducerStoredInputState(boardItem.activation);
	const hasControlState = hasProducerLineControlState(boardItem.activation);

	return {
		hasControlState,
		hasRuntimeState,
		requiresInstancePreservation: hasRuntimeState || hasControlState,
	};
};

export const hasBoardViewItemRuntimeState = (boardItem: BoardViewItem) =>
	readBoardViewItemPreservationFacts(boardItem).hasRuntimeState;

export const requiresBoardViewItemInstancePreservation = (boardItem: BoardViewItem) =>
	readBoardViewItemPreservationFacts(boardItem).requiresInstancePreservation;
