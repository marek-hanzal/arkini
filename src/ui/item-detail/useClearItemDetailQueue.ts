import type { PlayableGame } from "~/renderer/game/PlayableGame";
import type { ItemDetailPendingActionOwner } from "~/ui/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/ui/item-detail/useItemDetailPendingCommand";
import { clearItemJobQueueFx } from "~/engine/job/write/clearItemJobQueueFx";

export namespace useClearItemDetailQueue {
	export type Props = clearItemJobQueueFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runClearQueueFx = (game: PlayableGame, command: useClearItemDetailQueue.Props) =>
	game.runFx(clearItemJobQueueFx(command));

/** Clears only queued line-start intents for one exact Item Detail target. */
export const useClearItemDetailQueue = ({
	pendingKey,
	pendingOwner,
}: useClearItemDetailQueue.Options) =>
	useItemDetailPendingCommand({
		action: "clear-queue",
		failureMessage: "Queue could not be cleared.",
		pendingKey,
		pendingOwner,
		run: runClearQueueFx,
	});
