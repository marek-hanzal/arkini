import type { UiButton } from "~/ui/UiButton";

export interface DetailActionControl {
	disabled: boolean;
	label: string;
	onClick(): void;
	tone: UiButton.Tone;
}

export interface DetailProgressActionControl extends DetailActionControl {
	metaLabel?: string;
	progress?: number;
}
