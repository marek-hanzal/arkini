import { memo, type FC, useCallback } from "react";
import type { BottomNavSheet } from "~/play/logic/playSheetTypes";

export namespace BottomNavButton {
	export interface Props {
		active: boolean;
		label: string;
		icon: string;
		tone: BottomNavSheet;
		onOpen(sheet: BottomNavSheet): void;
	}
}

export const BottomNavButton: FC<BottomNavButton.Props> = memo(
	({ active, label, icon, tone, onOpen }) => {
		const handleClick = useCallback(
			() => onOpen(tone),
			[
				onOpen,
				tone,
			],
		);

		return (
			<button
				type="button"
				className="ak-bottom-nav-button"
				data-active={active ? "true" : "false"}
				data-tone={tone}
				data-bottom-nav-sheet={tone}
				onClick={handleClick}
			>
				<span className="ak-bottom-nav-icon">{icon}</span>
				<span>{label}</span>
			</button>
		);
	},
);
