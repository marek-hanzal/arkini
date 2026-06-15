import { memo, type FC, type RefObject } from "react";
import type { V0Sheet } from "~/v0/play/V0Sheet";
import type { V0DropTarget } from "~/v0/play/V0DragTypes";
import { TileEngineDropTarget } from "~/v0/tile-engine/TileEngineDropTarget";

export namespace V0BottomNav {
	export interface Props {
		activeSheet?: V0Sheet;
		onOpen(sheet: V0Sheet): void;
	}
}

interface ButtonProps {
	active: boolean;
	label: string;
	icon: string;
	tone: V0Sheet;
	onOpen(sheet: V0Sheet): void;
}

const NavButton: FC<ButtonProps> = memo(({ active, label, icon, tone, onOpen }) => {
	const button = (ref?: RefObject<HTMLDivElement | null>) => (
		<div ref={ref}>
			<button
				type="button"
				className="ak-bottom-nav-button"
				data-active={active ? "true" : "false"}
				data-tone={tone}
				onClick={() => onOpen(tone)}
			>
				<span className="ak-bottom-nav-icon">{icon}</span>
				<span>{label}</span>
			</button>
		</div>
	);

	if (tone !== "inventory") return button();

	return (
		<TileEngineDropTarget<V0DropTarget>
			id="v0-bottom-nav:inventory"
			data={{
				kind: "inventory",
			}}
		>
			{({ ref }) => button(ref)}
		</TileEngineDropTarget>
	);
});

export const V0BottomNav: FC<V0BottomNav.Props> = memo(({ activeSheet, onOpen }) => (
	<nav className="ak-bottom-nav">
		<div className="ak-bottom-nav-inner">
			<NavButton
				active={activeSheet === "inventory"}
				label="Inventory"
				icon="▦"
				tone="inventory"
				onOpen={onOpen}
			/>
			<NavButton
				active={activeSheet === "upgrades"}
				label="Upgrades"
				icon="▲"
				tone="upgrades"
				onOpen={onOpen}
			/>
			<NavButton
				active={activeSheet === "database"}
				label="Database"
				icon="◈"
				tone="database"
				onOpen={onOpen}
			/>
		</div>
	</nav>
));
