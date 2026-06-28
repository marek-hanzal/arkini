import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";

const hasStoredRequirementState = (requirement: ActivationRequirementView) =>
	requirement.type === "stored" && requirement.stored > 0;

const hasCraftInputState = (craft: BoardViewItem["craft"]) =>
	Boolean(craft && Object.values(craft.delivered).some((quantity) => quantity > 0));

const hasProducerRuntimeState = (activation: BoardViewItem["activation"]) =>
	Boolean(
		activation?.remainingCharges !== undefined ||
			activation?.productLines?.some(
				(line) =>
					line.isDefault ||
					line.inputs.some((input) => input.stored > 0) ||
					(line.requirements ?? []).some(hasStoredRequirementState),
			) ||
			activation?.inputs.some((input) => input.stored > 0),
	);

const hasStoredRequirementRuntimeState = (boardItem: BoardViewItem) =>
	Boolean(
		boardItem.activation?.requirements.some(hasStoredRequirementState) ||
			boardItem.craft?.requirements?.some(hasStoredRequirementState),
	);

export const isBoardViewItemRuntimeStatePreserved = (boardItem: BoardViewItem) =>
	hasCraftInputState(boardItem.craft) ||
	hasProducerRuntimeState(boardItem.activation) ||
	hasStoredRequirementRuntimeState(boardItem);
