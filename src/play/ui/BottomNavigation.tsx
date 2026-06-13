import type { FC } from "react";
import { BottomNavButton } from "~/play/ui/BottomNavButton";

export type ActiveSheet = "inventory" | "player" | "database" | "build";
export type BottomNavSheet = "inventory" | "player" | "database";

export namespace BottomNavigation {
	export interface Props {
		activeSheet?: ActiveSheet;
		onOpen(sheet: BottomNavSheet): void;
	}
}

export const BottomNavigation: FC<BottomNavigation.Props> = ({ activeSheet, onOpen }) => {
	return (
		<nav className="ak-bottom-nav">
			<div className="ak-bottom-nav-inner">
				<BottomNavButton
					active={activeSheet === "inventory"}
					label="Inventory"
					icon="▦"
					tone="inventory"
					onClick={() => onOpen("inventory")}
				/>
				<BottomNavButton
					active={activeSheet === "player"}
					label="Player"
					icon="◆"
					tone="player"
					onClick={() => onOpen("player")}
				/>
				<BottomNavButton
					active={activeSheet === "database"}
					label="Database"
					icon="◈"
					tone="database"
					onClick={() => onOpen("database")}
				/>
			</div>
		</nav>
	);
};
