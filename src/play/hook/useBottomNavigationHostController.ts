import { useMemo } from "react";
import { usePlayDragState } from "~/play/hook/usePlayDragState";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace useBottomNavigationHostController {
	export interface Props {}
}

/**
 * GPT:FIX
 *
 * This by itself is piece of shit we don't need.
 *
 * Why we cannot listen for drag events instead of using this crappy hook?
 */
export const useBottomNavigationHostController = (
	_props?: useBottomNavigationHostController.Props,
) => {
	const sheets = usePlaySheetsState();
	const drag = usePlayDragState();

	return useMemo(
		() => ({
			activeSheet: sheets.activeSheet,
			inventoryDropTargetActive: drag.activeDrag?.source.kind === "board",
			activeDropTargetNodeId: drag.activeDropTargetNodeId,
			onOpen: sheets.openSheet,
		}),
		[
			drag.activeDrag?.source.kind,
			drag.activeDropTargetNodeId,
			sheets.activeSheet,
			sheets.openSheet,
		],
	);
};
