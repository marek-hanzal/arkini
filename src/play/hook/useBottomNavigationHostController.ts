import { useMemo } from "react";
import { usePlayDragState } from "~/play/hook/usePlayDragState";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace useBottomNavigationHostController {
	export interface Props {}
}

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
