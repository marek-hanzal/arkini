import { Effect } from "effect";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import type { GameEvent } from "~/event/GameEventSchema";
import type {
	GameSave,
	GameSaveBoardItem,
	GameSaveProducerJob,
} from "~/engine/model/GameSaveSchema";

export namespace replaceDepletedProducerSourceCellOutputFx {
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

export const replaceDepletedProducerSourceCellOutputFx = Effect.fn(
	"replaceDepletedProducerSourceCellOutputFx",
)(function* ({
	events,
	job,
	nextSave,
	nowMs,
	producerItem,
}: replaceDepletedProducerSourceCellOutputFx.Props) {
	const sourceOutputIndex = events.findIndex(
		(event) =>
			event.type === "item.created" &&
			event.reason === "line-output" &&
			event.originItemInstanceId === job.itemInstanceId &&
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

	yield* removeBoardItemFromSaveFx({
		itemInstanceId: sourceOutputEvent.to.itemInstanceId,
		runtimeState: "remove",
		save: nextSave,
	});
	nextSave.board.items[job.itemInstanceId] = {
		...outputItem,
		id: job.itemInstanceId,
		x: producerItem.x,
		y: producerItem.y,
	};

	return {
		events: events.map((event, index) =>
			index === sourceOutputIndex
				? {
						atMs: nowMs,
						fromItemId: producerItem.itemId,
						itemInstanceId: job.itemInstanceId,
						reason: "producer-depleted" as const,
						toItemId: sourceOutputEvent.itemId,
						type: "item.replaced" as const,
					}
				: event,
		),
		replaced: true,
	};
});
