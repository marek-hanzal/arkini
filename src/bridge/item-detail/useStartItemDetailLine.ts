import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { startLineFx } from "~/engine/job/write/startLineFx";

export namespace useStartPendingItemDetailLine {
	export type Props = startLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runStartFx = (game: Game, command: useStartPendingItemDetailLine.Props) =>
	game.runFx(startLineFx(command));

/** Starts or enqueues one exact Item Detail line request. */
export const useStartPendingItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useStartPendingItemDetailLine.Options) => {
	const command = useItemDetailPendingCommand({
		action: "start",
		failureMessage: "Work could not be started.",
		pendingKey,
		pendingOwner,
		run: runStartFx,
	});
	return {
		error: command.error,
		pending: command.pending,
		start: command.run,
	};
};
