import { stageActivationDrops } from "~/animation/stageActivationDrops";
import { highlightInventoryNav } from "~/animation/highlightInventoryNav";
import type { Command } from "~/command/Command";
import { cellKey } from "~/board/util/cell";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { ActivationResultSchema } from "~/activation/type/ActivationResultSchema";

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
		): Promise<ActivationResultSchema.Type>;
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
				result,
			],
			activeSheet,
			visualMotions,
		});

		await invalidatePlayData([
			"board",
			"inventory",
			"databaseStatus",
		]);

		if (result.placements.some((placement) => placement.kind === "inventory")) {
			highlightInventoryNav();
		}
	} catch (error) {
		feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
		feedback.showError(error);
	}
};
