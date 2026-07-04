import { readLiveBoardItemView } from "~/board/view/readLiveBoardItemView";
import { readCraftRunState } from "~/craft/view/readCraftRunState";
import { isProducerReady } from "~/producer/view/isProducerReady";
import { readLineRunState } from "~/producer/view/readLineRunState";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";
import { readBoardUtilityItemSheet } from "~/board/BoardUtilityItem";
import { isBoardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { readCheatSpeedToggleModeFromItemId } from "~/cheat/GameCheatSpeedItem";
import type { GameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";

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
		  }
		| {
				type: "activate-board-memory";
				boardItemId: string;
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

	if (isBoardMemoryItemId(boardItem.itemId)) {
		return {
			boardItemId: boardItem.id,
			type: "activate-board-memory",
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
			liveBoardItem.activation.lines?.find(
				(line) => line.isDefault && line.kind === "effect",
			),
			liveBoardItem.activation.lines?.find(
				(line) => line.isDefault && line.kind === "product",
			),
		].filter((line): line is NonNullable<typeof line> => Boolean(line));
		const runnableDefaultLine = defaultLines.find(
			(line) =>
				readLineRunState({
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
