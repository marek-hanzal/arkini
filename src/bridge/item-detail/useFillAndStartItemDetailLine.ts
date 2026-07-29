import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { fillAndStartLineFx } from "~/engine/job/write/fillAndStartLineFx";

export namespace useFillAndStartItemDetailLine {
	export type Props = fillAndStartLineFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runFillAndStartFx = (game: Game, command: useFillAndStartItemDetailLine.Props) =>
	game.runFx(fillAndStartLineFx(command));

/** Runs the authoritative Fill & Start intent for one exact Item Detail line. */
export const useFillAndStartItemDetailLine = ({
	pendingKey,
	pendingOwner,
}: useFillAndStartItemDetailLine.Options) => {
	const command = useItemDetailPendingCommand({
		action: "start",
		failureMessage: "Work could not be started.",
		pendingKey,
		pendingOwner,
		run: runFillAndStartFx,
	});
	return {
		error: command.error,
		pending: command.pending,
		run: command.run,
	};
};
