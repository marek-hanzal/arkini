import { useCallback, useMemo } from "react";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { usePlayDraggableControl } from "~/play/hook/usePlayDraggableControl";
import { usePlayEventQueue } from "~/play/hook/usePlayEventQueue";
import { usePlayFeedback } from "~/play/hook/usePlayFeedback";
import { usePlayManualItemActions } from "~/play/hook/usePlayManualItemActions";
import { usePlayProducerActions } from "~/play/hook/usePlayProducerActions";
import { usePlaySave } from "~/play/hook/usePlaySave";
import { usePlaySheets } from "~/play/hook/usePlaySheets";
import { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";

export namespace usePlayShellController {
	export interface Props {}
}

export const usePlayShellController = (_props?: usePlayShellController.Props) => {
	usePlaySave();

	const sheets = usePlaySheets();
	const visualMotions = useVisualItemMotions();
	const schedulePlayEvent = usePlayEventQueue();
	const feedback = usePlayFeedback();
	const drag = usePlayDraggableControl({
		feedback,
		schedule: schedulePlayEvent,
		visualMotions,
	});
	const producerActions = usePlayProducerActions({
		activeSheet: sheets.activeSheet,
		visualMotions,
		feedback,
		schedule: schedulePlayEvent,
	});
	const manualActions = usePlayManualItemActions({
		visualMotions,
		feedback,
		schedule: schedulePlayEvent,
	});
	const activateBoardTile = useCallback(
		(item: BoardViewItem) => {
			if (!item.activation) return;

			void producerActions.produceFrom(
				item,
				item.activation.kind === "stash" ? "exhaust" : "single",
			);
		},
		[
			producerActions.produceFrom,
		],
	);
	const openBoardTileDetail = useCallback(
		(item: BoardViewItem) => {
			sheets.openItem(item.id);
		},
		[
			sheets.openItem,
		],
	);
	const placeInventorySlot = useCallback(
		(slot: InventorySlot) => {
			void manualActions.placeInventoryOnBoardWithFly(slot);
		},
		[
			manualActions.placeInventoryOnBoardWithFly,
		],
	);
	const boardDrag = useMemo(
		() => ({
			activeDrag: drag.activeDrag ?? undefined,
			activeDropTargetNodeId: drag.activeDropTargetNodeId,
			isSourceHidden: drag.isSourceHidden,
			setActiveDropTargetNodeId: drag.setActiveDropTargetNodeId,
			start: drag.start,
			drop: drag.drop,
			cancel: drag.cancel,
		}),
		[
			drag.activeDrag,
			drag.activeDropTargetNodeId,
			drag.cancel,
			drag.drop,
			drag.isSourceHidden,
			drag.setActiveDropTargetNodeId,
			drag.start,
		],
	);
	const boardFeedback = useMemo(
		() => ({
			invalidCellKey: feedback.invalidBoardCellKey,
			mergedCellKey: feedback.mergedBoardCellKey,
			imprintedCellKey: feedback.imprintedBoardCellKey,
		}),
		[
			feedback.imprintedBoardCellKey,
			feedback.invalidBoardCellKey,
			feedback.mergedBoardCellKey,
		],
	);
	const boardActions = useMemo(
		() => ({
			tileSingleActivate: activateBoardTile,
			tileLongActivate: openBoardTileDetail,
		}),
		[
			activateBoardTile,
			openBoardTileDetail,
		],
	);

	return {
		activeSheet: sheets.activeSheet,
		renderedSheet: sheets.renderedSheet,
		selectedBoardItemId: sheets.selectedBoardItemId,
		closeSheet: sheets.closeSheet,
		openSheet: sheets.openSheet,
		visualMotions,
		drag,
		boardDrag,
		boardFeedback,
		boardActions,
		invalidInventorySlot: feedback.invalidInventorySlot,
		placeInventorySlot,
	};
};
