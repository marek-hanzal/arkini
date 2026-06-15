import type { Feedback } from "~/v0/play/feedback/Feedback";

export namespace BoardSurface {
	export interface Props {
		feedback: Feedback.Type;
		feedbackFlags: ReadonlySet<string>;
		onOpenItem(boardItemId: string): void;
	}

	export interface TileData {
		boardItemId: string;
	}
}
