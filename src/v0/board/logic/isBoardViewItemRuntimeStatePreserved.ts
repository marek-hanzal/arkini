import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";

const hasCraftInputState = (craft: BoardViewItem["craft"]) =>
	Boolean(craft && Object.values(craft.delivered).some((quantity) => quantity > 0));

const hasProducerRuntimeState = (activation: BoardViewItem["activation"]) =>
	Boolean(
		activation?.remainingCharges !== undefined ||
			activation?.productLines?.some(
				(line) => line.isDefault || line.inputs.some((input) => input.stored > 0),
			) ||
			activation?.inputs.some((input) => input.stored > 0),
	);

export const isBoardViewItemRuntimeStatePreserved = (boardItem: BoardViewItem) =>
	hasCraftInputState(boardItem.craft) || hasProducerRuntimeState(boardItem.activation);
