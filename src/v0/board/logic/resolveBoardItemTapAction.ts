import { readLiveBoardItemView } from "~/v0/board/logic/readLiveBoardItemView";
import { readCraftRunState } from "~/v0/craft/logic/readCraftRunState";
import { isProducerReady } from "~/v0/producer/logic/isProducerReady";
import { readProducerLineRunState } from "~/v0/producer/logic/readProducerLineRunState";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ActiveSheetState } from "~/v0/play/sheet/ActiveSheetState";
import { readBoardUtilityItemSheet } from "~/v0/board/BoardUtilityItem";
import { readCheatSpeedToggleModeFromItemId } from "~/v0/game/cheat/GameCheatSpeedItem";
import type { GameCheatSpeedMode } from "~/v0/game/cheat/GameCheatSpeedMode";

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
				lineId?: string;
		  }
		| {
				type: "open-sheet";
				sheet: ActiveSheetState;
		  }
		| {
				type: "set-cheat-speed-mode";
				mode: GameCheatSpeedMode;
		  };
}

export const resolveBoardItemTapAction = ({
	boardItem,
	nowMs,
}: resolveBoardItemTapAction.Props): resolveBoardItemTapAction.Result => {
	const cheatSpeedMode = readCheatSpeedToggleModeFromItemId(boardItem.itemId);
	if (cheatSpeedMode) {
		return {
			mode: cheatSpeedMode,
			type: "set-cheat-speed-mode",
		};
	}

	const utilitySheet = readBoardUtilityItemSheet(boardItem.itemId);
	if (utilitySheet) {
		return {
			sheet: utilitySheet,
			type: "open-sheet",
		};
	}

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
			sheet: {
				boardItemId: boardItem.id,
				type: "item",
			},
			type: "open-sheet",
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
			sheet: {
				boardItemId: boardItem.id,
				type: "item",
			},
			type: "open-sheet",
		};
	}

	if (liveBoardItem?.activation?.kind === "producer") {
		const defaultLines = [
			liveBoardItem.activation.producerLines?.find(
				(line) => line.isDefault && line.lineKind === "effect",
			),
			liveBoardItem.activation.producerLines?.find(
				(line) => line.isDefault && line.lineKind === "product",
			),
		].filter((line): line is NonNullable<typeof line> => Boolean(line));
		const runnableDefaultLine = defaultLines.find(
			(line) =>
				readProducerLineRunState({
					line,
				}).canRunAction,
		);

		if (runnableDefaultLine) {
			return {
				type: "activate",
				activation: "single",
				boardItemId: boardItem.id,
				lineId: runnableDefaultLine.lineId,
			};
		}
		return {
			sheet: {
				boardItemId: boardItem.id,
				type: "item",
			},
			type: "open-sheet",
		};
	}

	return {
		sheet: {
			boardItemId: boardItem.id,
			type: "item",
		},
		type: "open-sheet",
	};
};
