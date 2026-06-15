import { stageProducerDrops } from "~/animation/stageProducerDrops";
import { highlightInventoryNav } from "~/animation/highlightInventoryNav";
import type { Command } from "~/command/Command";
import { cellKey } from "~/board/util/cell";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem, ProducerDropResult } from "~/play/logic/playTypes";

export namespace produceFrom {
	export interface Props {
		activeSheet?: ActiveSheet;
		boardItem: BoardViewItem;
		activation: "single" | "exhaust";
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
		run(
			command: Extract<
				Command,
				{
					type: "producer.activate";
				}
			>,
		): Promise<ProducerDropResult>;
		feedback: Feedback;
		invalidatePlayData(
			targets: readonly ("board" | "inventory" | "databaseStatus")[],
		): Promise<void>;
	}
}

export const produceFrom = async ({
	activeSheet,
	boardItem,
	activation,
	visualMotions,
	run,
	feedback,
	invalidatePlayData,
}: produceFrom.Props) => {
	try {
		const result = await run({
			type: "producer.activate",
			boardItemId: boardItem.id,
			activation,
		});

		stageProducerDrops({
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
