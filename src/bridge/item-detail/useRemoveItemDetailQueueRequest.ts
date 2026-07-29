import type { Game } from "~/bridge/game/Game";
import type { ItemDetailPendingActionOwner } from "~/bridge/item-detail/ItemDetailPendingActionOwner";
import { useItemDetailPendingCommand } from "~/bridge/item-detail/useItemDetailPendingCommand";
import { removeItemJobQueueRequestFx } from "~/engine/job/write/removeItemJobQueueRequestFx";

export namespace useRemoveItemDetailQueueRequest {
	export type Props = removeItemJobQueueRequestFx.Props;

	export interface Options {
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
	}
}

const runRemoveQueueRequestFx = (game: Game, command: useRemoveItemDetailQueueRequest.Props) =>
	game.runFx(removeItemJobQueueRequestFx(command));

/** Removes one exact queued request without affecting active or sibling work. */
export const useRemoveItemDetailQueueRequest = ({
	pendingKey,
	pendingOwner,
}: useRemoveItemDetailQueueRequest.Options) =>
	useItemDetailPendingCommand({
		action: "delete-queue-request",
		failureMessage: "Queued work could not be deleted.",
		pendingKey,
		pendingOwner,
		run: runRemoveQueueRequestFx,
	});
