import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { playQueryKeys } from "~/play/hook/playQueryKeys";
import { placeInventoryOnBoardWithFly } from "~/play/logic/placeInventoryOnBoardWithFly";
import type { BoardView, InventorySlot } from "~/play/logic/playTypes";
import type { FlyerKind, VisualMeta, RectLike } from "~/play/types";

export namespace usePlayManualItemActions {
	export interface Props {
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
		feedback: Feedback;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
		hideSources(ids: readonly string[]): void;
		clearHiddenSources(): void;
	}
}

export const usePlayManualItemActions = ({
	addFlyer,
	feedback,
	schedule,
	hideSources,
	clearHiddenSources,
}: usePlayManualItemActions.Props) => {
	const queryClient = useQueryClient();
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand({
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
					addFlyer,
					run,
					feedback,
					hideSources,
					clearHiddenSources,
					invalidatePlayData,
				}),
			),
		[
			addFlyer,
			clearHiddenSources,
			feedback,
			hideSources,
			invalidatePlayData,
			readBoard,
			run,
			schedule,
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
