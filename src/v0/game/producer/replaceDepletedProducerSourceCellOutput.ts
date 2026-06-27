import { Effect } from "effect";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type {
	GameSave,
	GameSaveBoardItem,
	GameSaveProducerJob,
} from "~/v0/game/engine/model/GameSaveSchema";

export namespace replaceDepletedProducerSourceCellOutput {
	export interface Props {
		events: GameEvent[];
		job: GameSaveProducerJob;
		nextSave: GameSave;
		nowMs: number;
		producerItem: GameSaveBoardItem;
	}
}

const isSameBoardCell = (
	left: {
		x: number;
		y: number;
	},
	right: {
		x: number;
		y: number;
	},
) => left.x === right.x && left.y === right.y;

export const replaceDepletedProducerSourceCellOutput = Effect.fn(
	"replaceDepletedProducerSourceCellOutput",
)(function* ({
	events,
	job,
	nextSave,
	nowMs,
	producerItem,
}: replaceDepletedProducerSourceCellOutput.Props) {
	const sourceOutputIndex = events.findIndex(
		(event) =>
			event.type === "item.created" &&
			event.reason === "product-output" &&
			event.originItemInstanceId === job.producerItemInstanceId &&
			event.to.kind === "board" &&
			isSameBoardCell(event.to, producerItem),
	);
	const sourceOutputEvent = events[sourceOutputIndex];
	if (sourceOutputIndex < 0 || sourceOutputEvent?.type !== "item.created") {
		return {
			events,
			replaced: false,
		};
	}
	if (sourceOutputEvent.to.kind !== "board") {
		return {
			events,
			replaced: false,
		};
	}

	const outputItem = nextSave.board.items[sourceOutputEvent.to.itemInstanceId];
	if (!outputItem) {
		return {
			events,
			replaced: false,
		};
	}

	delete nextSave.board.items[sourceOutputEvent.to.itemInstanceId];
	nextSave.board.items[job.producerItemInstanceId] = {
		...outputItem,
		id: job.producerItemInstanceId,
		x: producerItem.x,
		y: producerItem.y,
	};

	return {
		events: events.map((event, index) =>
			index === sourceOutputIndex
				? {
						atMs: nowMs,
						fromItemId: producerItem.itemId,
						itemInstanceId: job.producerItemInstanceId,
						reason: "producer-depleted" as const,
						toItemId: sourceOutputEvent.itemId,
						type: "item.replaced" as const,
					}
				: event,
		),
		replaced: true,
	};
});
