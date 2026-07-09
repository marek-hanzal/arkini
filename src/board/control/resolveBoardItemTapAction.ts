import { match, P } from "ts-pattern";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { readLiveBoardItemView } from "~/board/view/readLiveBoardItemView";
import { readBoardUtilityItemSheet } from "~/board/BoardUtilityItem";
import { readCheatSpeedToggleModeFromItemId } from "~/cheat/GameCheatSpeedItem";
import { readItemSpecialInteractionKind } from "~/item/ItemInteractionProfile";
import type { GameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import { readCraftRunState } from "~/craft/view/readCraftRunState";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";
import { isProducerReady } from "~/producer/view/isProducerReady";
import { readLineRunState } from "~/producer/view/readLineRunState";

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

const createOpenBoardItemSheetAction = ({
	boardItemId,
}: {
	boardItemId: string;
}): resolveBoardItemTapAction.Result => ({
	sheet: {
		boardItemId,
		type: "item",
	},
	type: "open-sheet",
});

const resolveSpecialBoardItemTapAction = ({
	boardItem,
}: Pick<resolveBoardItemTapAction.Props, "boardItem">):
	| resolveBoardItemTapAction.Result
	| undefined => {
	switch (readItemSpecialInteractionKind(boardItem.itemId)) {
		case "clock": {
			const cheatSpeedMode = readCheatSpeedToggleModeFromItemId(boardItem.itemId);
			if (!cheatSpeedMode) return undefined;
			return {
				mode: cheatSpeedMode,
				type: "set-cheat-speed-mode",
			};
		}
		case "memory":
			return {
				boardItemId: boardItem.id,
				type: "activate-board-memory",
			};
		case "cheat-inventory":
		case "inventory":
		case "nuke-save": {
			const utilitySheet = readBoardUtilityItemSheet(boardItem.itemId);
			return utilitySheet
				? {
						sheet: utilitySheet,
						type: "open-sheet",
					}
				: undefined;
		}
		case "none":
			return undefined;
	}
};

const resolveCraftBoardItemTapAction = ({
	boardItem,
	craft,
}: {
	boardItem: BoardViewItem;
	craft: NonNullable<BoardViewItem["craft"]>;
}): resolveBoardItemTapAction.Result =>
	match(craft)
		.with(
			{
				complete: true,
			},
			() => ({
				boardItemId: boardItem.id,
				type: "claim-craft" as const,
			}),
		)
		.with(
			{
				phase: "collecting_inputs",
			},
			(liveCraft) => {
				const craftRunState = readCraftRunState({
					craft: liveCraft,
				});
				return craftRunState.canRunAction
					? {
							boardItemId: boardItem.id,
							recipeId: liveCraft.id,
							type: "start-craft" as const,
						}
					: createOpenBoardItemSheetAction({
							boardItemId: boardItem.id,
						});
			},
		)
		.otherwise(() =>
			createOpenBoardItemSheetAction({
				boardItemId: boardItem.id,
			}),
		);

const resolveStashBoardItemTapAction = ({
	boardItem,
	nowMs,
}: resolveBoardItemTapAction.Props): resolveBoardItemTapAction.Result =>
	boardItem.activation && isProducerReady(boardItem.activation, nowMs)
		? {
				activation: "exhaust",
				boardItemId: boardItem.id,
				type: "activate",
			}
		: createOpenBoardItemSheetAction({
				boardItemId: boardItem.id,
			});

const readRunnableDefaultProducerLine = ({ boardItem }: { boardItem: BoardViewItem }) => {
	const defaultLines = [
		boardItem.activation?.lines?.find((line) => line.isDefault && line.kind === "effect"),
		boardItem.activation?.lines?.find((line) => line.isDefault && line.kind === "product"),
	].filter((line): line is NonNullable<typeof line> => Boolean(line));

	return defaultLines.find(
		(line) =>
			readLineRunState({
				line,
			}).canRunAction,
	);
};

const resolveProducerBoardItemTapAction = ({
	boardItem,
}: Pick<resolveBoardItemTapAction.Props, "boardItem">): resolveBoardItemTapAction.Result => {
	const runnableDefaultLine = readRunnableDefaultProducerLine({
		boardItem,
	});
	return runnableDefaultLine
		? {
				activation: "single",
				boardItemId: boardItem.id,
				lineId: runnableDefaultLine.lineId,
				type: "activate",
			}
		: createOpenBoardItemSheetAction({
				boardItemId: boardItem.id,
			});
};

const resolveLiveBoardItemTapAction = ({
	boardItem,
	nowMs,
}: resolveBoardItemTapAction.Props): resolveBoardItemTapAction.Result =>
	match(boardItem)
		.with(
			{
				craft: P.nonNullable,
			},
			({ craft }) =>
				resolveCraftBoardItemTapAction({
					boardItem,
					craft,
				}),
		)
		.with(
			{
				activation: {
					kind: "stash",
				},
			},
			() =>
				resolveStashBoardItemTapAction({
					boardItem,
					nowMs,
				}),
		)
		.with(
			{
				activation: {
					kind: "producer",
				},
			},
			() =>
				resolveProducerBoardItemTapAction({
					boardItem,
				}),
		)
		.otherwise(() =>
			createOpenBoardItemSheetAction({
				boardItemId: boardItem.id,
			}),
		);

export const resolveBoardItemTapAction = ({
	boardItem,
	nowMs,
}: resolveBoardItemTapAction.Props): resolveBoardItemTapAction.Result => {
	const specialAction = resolveSpecialBoardItemTapAction({
		boardItem,
	});
	if (specialAction) return specialAction;

	return resolveLiveBoardItemTapAction({
		boardItem:
			readLiveBoardItemView({
				boardItem,
				nowMs,
			}) ?? boardItem,
		nowMs,
	});
};
