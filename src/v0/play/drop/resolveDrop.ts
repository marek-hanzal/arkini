import { match } from "ts-pattern";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource, DropTarget } from "~/v0/play/DragTypes";
import type { Feedback } from "~/v0/play/Feedback";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { rejectDrop } from "~/v0/play/drop/rejectDrop";
import { resolveBoardCellDrop } from "~/v0/play/drop/resolveBoardCellDrop";
import { resolveBoardInventoryDrop } from "~/v0/play/drop/resolveBoardInventoryDrop";
import { resolveInventoryCellDrop } from "~/v0/play/drop/resolveInventoryCellDrop";
import { resolveInventorySlotDrop } from "~/v0/play/drop/resolveInventorySlotDrop";
import { withDropErrorFeedback } from "~/v0/play/drop/withDropErrorFeedback";

export namespace resolveDrop {
	export interface Props {
		context: TileEngine.DropContext<unknown, unknown, DragSource, DropTarget>;
		board: BoardView;
		inventory: InventoryView;
		feedback: Feedback;
		actions: DropActions;
	}
}

const withSafeCommit = ({
	feedback,
	outcome,
}: {
	feedback: Feedback;
	outcome: TileEngine.DropOutcome;
}): TileEngine.DropOutcome => {
	if (typeof outcome === "string" || outcome.type !== "accept" || !outcome.commit) {
		return outcome;
	}

	return {
		type: "accept",
		commit: withDropErrorFeedback({
			feedback,
			commit: async () => outcome.commit?.(),
		}),
	};
};

export const resolveDrop = ({
	context,
	board,
	inventory,
	feedback,
	actions,
}: resolveDrop.Props): TileEngine.DropOutcome => {
	const target = context.target;
	if (!target) return rejectDrop();

	try {
		const outcome = match({
			source: context.source,
			target,
		})
			.with(
				{
					source: {
						kind: "board",
					},
					target: {
						kind: "cell",
					},
				},
				({ source, target }) =>
					resolveBoardCellDrop({
						source,
						target,
						board,
						feedback,
						actions,
					}),
			)
			.with(
				{
					source: {
						kind: "board",
					},
					target: {
						kind: "inventory",
					},
				},
				({ source }) =>
					resolveBoardInventoryDrop({
						source,
						actions,
					}),
			)
			.with(
				{
					source: {
						kind: "inventory",
					},
					target: {
						kind: "inventory-slot",
					},
				},
				({ source, target }) =>
					resolveInventorySlotDrop({
						source,
						target,
						actions,
					}),
			)
			.with(
				{
					source: {
						kind: "inventory",
					},
					target: {
						kind: "cell",
					},
				},
				({ source, target }) =>
					resolveInventoryCellDrop({
						source,
						target,
						inventory,
						feedback,
						actions,
					}),
			)
			.otherwise(() => rejectDrop());

		return withSafeCommit({
			feedback,
			outcome,
		});
	} catch (error) {
		feedback.showError(error);
		return rejectDrop();
	}
};
