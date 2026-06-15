import { useQueryClient } from "@tanstack/react-query";
import type { Command } from "~/action/command";
import { useCallback, useMemo } from "react";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import { playQueryKeys } from "~/play/hook/playQueryKeys";
import { placeInventoryOnBoardWithFly } from "~/play/logic/placeInventoryOnBoardWithFly";
import type { BoardView, InventorySlot } from "~/play/logic/playTypes";

export namespace usePlayManualItemActions {
	export interface Props {
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
		feedback: Feedback;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
	}
}

export const usePlayManualItemActions = ({
	visualMotions,
	feedback,
	schedule,
}: usePlayManualItemActions.Props) => {
	const queryClient = useQueryClient();
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand<
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
