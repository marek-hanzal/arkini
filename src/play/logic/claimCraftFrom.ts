import { stageCommandVisualEvents } from "~/animation/stageCommandVisualEvents";
import { cellKey } from "~/board/util/cell";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";

export namespace claimCraftFrom {
	export interface Props {
		activeSheet?: ActiveSheet;
		boardItem: BoardViewItem;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
		run(
			command: Extract<
				Command,
				{
					type: "craft.claim";
				}
			>,
		): Promise<
			CommandResult<
				Extract<
					Command,
					{
						type: "craft.claim";
					}
				>
			>
		>;
		feedback: Feedback;
		invalidatePlayData(
			targets: readonly ("board" | "inventory" | "databaseStatus")[],
		): Promise<void>;
	}
}

export const claimCraftFrom = async ({
	activeSheet,
	boardItem,
	visualMotions,
	run,
	feedback,
	invalidatePlayData,
}: claimCraftFrom.Props) => {
	try {
		const result = await run({
			type: "craft.claim",
			boardItemId: boardItem.id,
		});

		stageCommandVisualEvents({
			events: result.visualEvents,
			activeSheet,
			visualMotions,
		});

		await invalidatePlayData([
			"board",
			"inventory",
			"databaseStatus",
		]);
	} catch (error) {
		feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
		feedback.showError(error);
	}
};
