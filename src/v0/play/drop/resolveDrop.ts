import { match } from "ts-pattern";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { rejectDrop } from "~/v0/play/drop/rejectDrop";
import { resolveBoardCellDrop } from "~/v0/play/drop/resolveBoardCellDrop";
import { resolveInventoryCellDrop } from "~/v0/play/drop/resolveInventoryCellDrop";
import { resolveInventorySlotDrop } from "~/v0/play/drop/resolveInventorySlotDrop";
import { withDropErrorFeedback } from "~/v0/play/drop/withDropErrorFeedback";

export namespace resolveDrop {
	export interface Props {
		context: TileEngine.DropContext<unknown, unknown, DragSource, DropTarget>;
		board: BoardView;
		config: GameConfig;
		inventory: InventoryView;
		feedback: Feedback.Type;
		actions: DropActions;
	}
}

const withSafeCommit = ({
	feedback,
	outcome,
}: {
	feedback: Feedback.Type;
	outcome: TileEngine.DropOutcome;
}): TileEngine.DropOutcome => {
	if (typeof outcome === "string" || outcome.type !== "accept" || !outcome.commit) {
		return outcome;
	}

	return {
		type: "accept",
		animation: outcome.animation,
		commit: withDropErrorFeedback({
			feedback,
			commit: async () => outcome.commit?.(),
		}),
	};
};

export const resolveDrop = ({
	context,
	board,
	config,
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
						config,
						feedback,
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
						inventory,
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
						board,
						config,
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
