import { useMemo } from "react";
import { usePlayDragState } from "~/play/hook/usePlayDragState";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";

export namespace useBottomNavigation {
	export interface Props {}
}

export const useBottomNavigation = (_props?: useBottomNavigation.Props) => {
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
