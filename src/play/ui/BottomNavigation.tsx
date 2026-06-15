import { memo, type FC } from "react";
import type { ActiveSheet, BottomNavSheet } from "~/play/logic/playSheetTypes";
import { BottomNavButton } from "~/play/ui/BottomNavButton";

export namespace BottomNavigation {
	export interface Props {
		activeSheet?: ActiveSheet;
		inventoryDropTargetActive?: boolean;
		activeDropTargetNodeId?: string | null;
		onOpen(sheet: BottomNavSheet): void;
	}
}

export const BottomNavigation: FC<BottomNavigation.Props> = memo(
	({ activeSheet, inventoryDropTargetActive = false, activeDropTargetNodeId, onOpen }) => {
        /**
         * GPT:FIX
         *
         * We've 3 buttons, but they're not aligned (3 columns or 3 same sized flex)
         */
		return (
			<nav className="ak-bottom-nav">
				<div className="ak-bottom-nav-inner">
					<BottomNavButton
						active={activeSheet === "inventory"}
						label="Inventory"
						icon="▦"
						tone="inventory"
						dropTargetActive={inventoryDropTargetActive}
						activeDropTargetNodeId={activeDropTargetNodeId}
						onOpen={onOpen}
					/>
					<BottomNavButton
						active={activeSheet === "upgrades"}
						label="Upgrades"
						icon="▲"
						tone="upgrades"
						onOpen={onOpen}
					/>
					<BottomNavButton
						active={activeSheet === "database"}
						label="Database"
						icon="◈"
						tone="database"
						onOpen={onOpen}
					/>
				</div>
			</nav>
		);
	},
);
