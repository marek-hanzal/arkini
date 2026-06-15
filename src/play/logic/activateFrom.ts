import { stageActivationDrops } from "~/animation/stageActivationDrops";
import { highlightInventoryNav } from "~/animation/highlightInventoryNav";
import type { Command } from "~/command/Command";
import { cellKey } from "~/board/util/cell";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { CommandResult } from "~/command/CommandResult";

export namespace activateFrom {
	export interface Props {
		activeSheet?: ActiveSheet;
		boardItem: BoardViewItem;
		activation: "single" | "exhaust";
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
		run(
			command: Extract<
				Command,
				{
					type: "activation.activate";
				}
			>,
		): Promise<
			CommandResult<
				Extract<
					Command,
					{
						type: "activation.activate";
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

export const activateFrom = async ({
	activeSheet,
	boardItem,
	activation,
	visualMotions,
	run,
	feedback,
	invalidatePlayData,
}: activateFrom.Props) => {
	try {
		const result = await run({
			type: "activation.activate",
			boardItemId: boardItem.id,
			activation,
		});

		stageActivationDrops({
			results: [
				result.activation,
			],
			activeSheet,
			visualMotions,
		});

		await invalidatePlayData([
			"board",
			"inventory",
			"databaseStatus",
		]);

		if (result.activation.placements.some((placement) => placement.kind === "inventory")) {
			highlightInventoryNav();
		}
	} catch (error) {
		feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
		feedback.showError(error);
	}
};
