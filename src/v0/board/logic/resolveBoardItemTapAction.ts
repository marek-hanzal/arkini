import { readLiveBoardItemView } from "~/v0/board/logic/readLiveBoardItemView";
import { readCraftRunState } from "~/v0/craft/logic/readCraftRunState";
import { isProducerReady } from "~/v0/producer/logic/isProducerReady";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";

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
				activation: "single" | "exhaust";
				boardItemId: string;
		  }
		| {
				type: "open-detail";
				boardItemId: string;
		  };
}

export const resolveBoardItemTapAction = ({
	boardItem,
	nowMs,
}: resolveBoardItemTapAction.Props): resolveBoardItemTapAction.Result => {
	const liveBoardItem = readLiveBoardItemView({
		boardItem,
		nowMs,
	});
	const liveCraft = liveBoardItem?.craft;

	if (liveCraft?.complete) {
		return {
			type: "claim-craft",
			boardItemId: boardItem.id,
		};
	}

	if (liveCraft?.phase === "collecting_inputs") {
		const craftRunState = readCraftRunState({
			craft: liveCraft,
		});

		if (craftRunState.canRunAction) {
			return {
				type: "start-craft",
				boardItemId: boardItem.id,
				recipeId: liveCraft.id,
			};
		}

		return {
			type: "open-detail",
			boardItemId: boardItem.id,
		};
	}

	if (liveBoardItem?.activation?.kind === "stash") {
		if (isProducerReady(liveBoardItem.activation, nowMs)) {
			return {
				type: "activate",
				activation: "exhaust",
				boardItemId: boardItem.id,
			};
		}

		return {
			type: "open-detail",
			boardItemId: boardItem.id,
		};
	}

	if (liveBoardItem?.activation?.kind === "producer") {
		const defaultLine = liveBoardItem.activation.productLines?.find((line) => line.isDefault);
		const runState = defaultLine
			? readProducerProductLineRunState({
					line: defaultLine,
				})
			: undefined;
		if (runState?.canRunAction) {
			return {
				type: "activate",
				activation: "single",
				boardItemId: boardItem.id,
			};
		}
		return {
			type: "open-detail",
			boardItemId: boardItem.id,
		};
	}

	return {
		type: "open-detail",
		boardItemId: boardItem.id,
	};
};
