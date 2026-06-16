import { memo, type FC, type RefObject } from "react";
import type { Sheet } from "~/v0/play/sheet/Sheet";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import { TileEngineDropTarget } from "~/v0/tile-engine/TileEngineDropTarget";

export namespace BottomNav {
	export interface Props {
		activeSheet?: Sheet;
		onOpen(sheet: Sheet): void;
	}
}

interface ButtonProps {
	active: boolean;
	label: string;
	icon: string;
	tone: Sheet;
	onOpen(sheet: Sheet): void;
}

const NavButton: FC<ButtonProps> = memo(({ active, label, icon, tone, onOpen }) => {
	const button = (ref?: RefObject<HTMLDivElement | null>) => (
		<div
			ref={ref}
			className="ak-bottom-nav-slot"
		>
			<button
				type="button"
				className="ak-bottom-nav-button"
				data-active={active ? "true" : "false"}
				data-tone={tone}
				aria-label={label}
				title={label}
				onClick={() => onOpen(tone)}
			>
				<span
					className="ak-bottom-nav-icon"
					aria-hidden="true"
				>
					{icon}
				</span>
				<span className="ak-visually-hidden">{label}</span>
			</button>
		</div>
	);

	if (tone !== "inventory") return button();

	return (
		<TileEngineDropTarget<DropTarget>
			id="bottom-nav:inventory"
			data={{
				kind: "inventory",
			}}
		>
			{({ ref }) => button(ref)}
		</TileEngineDropTarget>
	);
});

export const BottomNav: FC<BottomNav.Props> = memo(({ activeSheet, onOpen }) => (
	<nav className="ak-layer-bottom-nav ak-bottom-nav">
		<div className="ak-bottom-nav-inner">
			<NavButton
				active={activeSheet === "inventory"}
				label="Inventory"
				icon="🎒"
				tone="inventory"
				onOpen={onOpen}
			/>
			<NavButton
				active={activeSheet === "upgrades"}
				label="Upgrades"
				icon="⏫"
				tone="upgrades"
				onOpen={onOpen}
			/>
			<NavButton
				active={activeSheet === "dev"}
				label="Dev"
				icon="🛠️"
				tone="dev"
				onOpen={onOpen}
			/>
		</div>
	</nav>
));
