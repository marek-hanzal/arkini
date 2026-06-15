import type { Command } from "~/command/Command";
import { useCallback, useMemo } from "react";
import { useBoardView } from "~/board/hook/useBoardView";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayFeedbackState } from "~/play/hook/usePlayFeedbackState";
import { usePlaySchedule } from "~/play/hook/usePlaySchedule";
import { usePlayVisualMotionsState } from "~/play/hook/usePlayVisualMotionsState";
import { placeInventoryOnBoardWithFly } from "~/play/logic/placeInventoryOnBoardWithFly";

export namespace usePlayManualItemActions {
	export interface Props {}
}

export const usePlayManualItemActions = (_props?: usePlayManualItemActions.Props) => {
	const board = useBoardView();
	const invalidatePlayData = usePlayDataInvalidation();
	const visualMotions = usePlayVisualMotionsState();
	const feedback = usePlayFeedbackState();
	const schedule = usePlaySchedule();
	const command = useRunCommandMutation<
		Extract<
			Command,
			{
				type: "inventory.place";
			}
		>
	>({
		invalidateOnSuccess: false,
	});
	const run = command.mutateAsync;
	const placeInventoryOnBoard = useCallback(
		(slot: InventorySlot) =>
			schedule("place inventory item", () =>
				placeInventoryOnBoardWithFly({
					board,
					slot,
					visualMotions,
					run,
					feedback,
					invalidatePlayData,
				}),
			),
		[
			feedback,
			invalidatePlayData,
			board,
			run,
			schedule,
			visualMotions,
		],
	);

	return useMemo(
		() => ({
			placeInventoryOnBoardWithFly: placeInventoryOnBoard,
		}),
		[
			placeInventoryOnBoard,
		],
	);
};
