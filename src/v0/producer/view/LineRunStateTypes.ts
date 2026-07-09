import type { LineView } from "~/board/view/LineViewSchema";

export namespace LineRunState {
	export interface Props {
		line: LineView;
	}

	export interface Result {
		canRunAction: boolean;
		inputsPartiallyAvailable: boolean;
		inputAvailabilityLabel?: string;
		label: string;
		progressLabel?: string;
		showProgress: boolean;
		statusMetaLabel?: string;
	}

	export interface Facts {
		canRunAction: boolean;
		inputsPartiallyAvailable: boolean;
		line: LineView;
		outputsDisabled: boolean;
		queueBlocked: boolean;
	}
}
