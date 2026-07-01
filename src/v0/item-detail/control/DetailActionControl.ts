import type { UiButton } from "~/v0/ui/UiButton";

export interface DetailActionControl {
	disabled: boolean;
	label: string;
	onClick(): void;
	tone: UiButton.Tone;
}

export interface DetailProgressActionControl extends DetailActionControl {
	progress?: number;
}
