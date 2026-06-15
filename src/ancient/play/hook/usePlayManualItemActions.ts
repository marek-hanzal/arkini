import { useQueryClient } from "@tanstack/react-query";
import type { Command } from "~/command/Command";
import { useCallback, useMemo } from "react";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { playQueryKeys } from "~/play/hook/playQueryKeys";
import { usePlayFeedbackState } from "~/play/hook/usePlayFeedbackState";
import { usePlaySchedule } from "~/play/hook/usePlaySchedule";
import { usePlayVisualMotionsState } from "~/play/hook/usePlayVisualMotionsState";
import { placeInventoryOnBoardWithFly } from "~/play/logic/placeInventoryOnBoardWithFly";

export namespace usePlayManualItemActions {
	export interface Props {}
}

export const usePlayManualItemActions = (_props?: usePlayManualItemActions.Props) => {
	const queryClient = useQueryClient();
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
	const readBoard = useCallback(
		() => queryClient.getQueryData<BoardView>(playQueryKeys.board),
		[
			queryClient,
		],
	);

	const placeInventoryOnBoard = useCallback(
		(slot: InventorySlot) =>
			schedule("place inventory item", () =>
				placeInventoryOnBoardWithFly({
					board: readBoard(),
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
			readBoard,
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
