import type { ActivationModeSchema } from "~/v0/activation/type/ActivationModeSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { readLiveCraftView } from "~/v0/board/logic/readLiveCraftView";

export namespace resolveBoardItemTapAction {
	export interface Props {
		boardItem: BoardViewItem;
		nowMs: number;
	}

	export type Result =
		| {
				type: "claim-craft";
				boardItemId: string;
		  }
		| {
				type: "activate";
				activation: ActivationModeSchema.Type;
				boardItemId: string;
		  }
		| {
				type: "none";
		  };
}

export const resolveBoardItemTapAction = ({
	boardItem,
	nowMs,
}: resolveBoardItemTapAction.Props): resolveBoardItemTapAction.Result => {
	const liveCraft = readLiveCraftView({
		craft: boardItem.craft,
		nowMs,
	});

	if (liveCraft?.complete) {
		return {
			type: "claim-craft",
			boardItemId: boardItem.id,
		};
	}

	if (boardItem.activation) {
		return {
			type: "activate",
			activation: boardItem.activation.kind === "stash" ? "exhaust" : "single",
			boardItemId: boardItem.id,
		};
	}

	return {
		type: "none",
	};
};
