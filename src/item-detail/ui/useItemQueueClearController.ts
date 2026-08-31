import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { useItemDetailPendingCommand } from "~/item-detail-frame/ui/useItemDetailPendingCommand";
import { clearItemJobQueueFx } from "~/production-job/write/clearItemJobQueueFx";

export namespace useItemQueueClearController {
	export interface Props {
		readonly queue: {
			readonly itemId: IdSchema.Type;
		};
	}

	export interface Output {
		readonly clearQueue: () => void;
		readonly error: string | null;
		readonly pending: boolean;
	}
}

/** Owns the whole-owner clear lifecycle for one exact item queue. */
export const useItemQueueClearController = ({
	queue,
}: useItemQueueClearController.Props): useItemQueueClearController.Output => {
	const command = useItemDetailPendingCommand({
		action: "clear-queue",
		failureMessage: "Queue could not be cleared.",
		pendingKey: JSON.stringify([
			"queue",
			queue.itemId,
		]),
		run: (game, props: clearItemJobQueueFx.Props) => game.runFx(clearItemJobQueueFx(props)),
	});

	return {
		clearQueue: () =>
			command.run({
				ownerItemId: queue.itemId,
			}),
		error: command.error,
		pending: command.pending,
	};
};
