import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";

export namespace useEnqueueItemDetailLine {
	export type Props = enqueueLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runEnqueueFx = (game: Game, command: useEnqueueItemDetailLine.Props) =>
	game.runFx(enqueueLineFx(command));

/** Appends one explicit future Item Detail line intent without filling or starting it. */
export const useEnqueueItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useEnqueueItemDetailLine.Options) =>
	useItemDetailPendingCommand({
		action: "enqueue",
		failureMessage: "Work could not be queued.",
		pendingKey,
		pendingOwner,
		run: runEnqueueFx,
	});
