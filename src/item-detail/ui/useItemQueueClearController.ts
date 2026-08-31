import type { IdSchema } from "~/game-config/schema/IdSchema";
import { useItemDetailPendingCommand } from "~/item-detail-frame/ui/useItemDetailPendingCommand";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";

export namespace useItemQueueClearController {
	export interface Props {
		readonly queue: {
			readonly itemId: IdSchema.Type;
		};
	}

	export interface Output {
		readonly clearQueueFn: () => void;
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
		runFx: (game, props: clearItemJobQueueFx.Props) => game.runFx(clearItemJobQueueFx(props)),
	});

	return {
		clearQueueFn: () =>
			command.runFn({
				ownerItemId: queue.itemId,
			}),
		error: command.error,
		pending: command.pending,
	};
};
