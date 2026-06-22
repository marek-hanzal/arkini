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
				type: "start-craft";
				boardItemId: string;
				recipeId: string;
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

	if (liveCraft?.phase === "collecting_inputs") {
		return {
			type: "start-craft",
			boardItemId: boardItem.id,
			recipeId: liveCraft.id,
		};
	}

	if (boardItem.activation?.kind === "stash") {
		return {
			type: "activate",
			activation: "exhaust",
			boardItemId: boardItem.id,
		};
	}

	if (
		boardItem.activation?.kind === "producer" &&
		boardItem.activation.productLines?.some((line) => line.isDefault)
	) {
		return {
			type: "activate",
			activation: "single",
			boardItemId: boardItem.id,
		};
	}

	return {
		type: "none",
	};
};
