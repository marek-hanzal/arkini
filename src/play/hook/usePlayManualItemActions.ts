import { useCallback } from "react";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { placeInventoryOnBoardWithFly } from "~/play/logic/placeInventoryOnBoardWithFly";
import type { BoardViewItem, InventorySlot } from "~/play/logic/playTypes";
import { stashBoardWithFly } from "~/play/logic/stashBoardWithFly";
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
	const board = usePlayBoard().data;
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand({
		invalidateOnSuccess: false,
	});

	return {
		stashBoardWithFly: useCallback(
			(boardItem: BoardViewItem) =>
				schedule("stash board item", () =>
					stashBoardWithFly({
						boardItem,
						addFlyer,
						run: command.mutateAsync,
						feedback,
						hideSources,
						clearHiddenSources,
						invalidatePlayData,
					}),
				),
			[
				addFlyer,
				clearHiddenSources,
				command.mutateAsync,
				feedback,
				hideSources,
				invalidatePlayData,
				schedule,
			],
		),
		placeInventoryOnBoardWithFly: useCallback(
			(slot: InventorySlot) =>
				schedule("place inventory item", () =>
					placeInventoryOnBoardWithFly({
						board,
						slot,
						addFlyer,
						run: command.mutateAsync,
						feedback,
						hideSources,
						clearHiddenSources,
						invalidatePlayData,
					}),
				),
			[
				addFlyer,
				board,
				clearHiddenSources,
				command.mutateAsync,
				feedback,
				hideSources,
				invalidatePlayData,
				schedule,
			],
		),
	};
};
