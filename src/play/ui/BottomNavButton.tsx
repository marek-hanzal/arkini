import type { FC } from "react";
import type { BottomNavSheet } from "~/play/logic/playSheetTypes";

export namespace BottomNavButton {
	export interface Props {
		active: boolean;
		label: string;
		icon: string;
		tone: BottomNavSheet;
		onClick(): void;
	}
}

export const BottomNavButton: FC<BottomNavButton.Props> = ({
	active,
	label,
	icon,
	tone,
	onClick,
}) => {
	return (
		<button
			type="button"
			className="ak-bottom-nav-button"
			data-active={active ? "true" : "false"}
			data-tone={tone}
			data-bottom-nav-sheet={tone}
			onClick={onClick}
		>
			<span className="ak-bottom-nav-icon">{icon}</span>
			<span>{label}</span>
		</button>
	);
};
