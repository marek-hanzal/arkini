import { Effect } from "effect";
import { readBoardItemCellFx } from "~/board/readBoardItemCellFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import type { ProducerChargeCompletionOutcome } from "~/producer/completeProducerJobChargesFx";
import type { ProducerDeliveryItem } from "~/producer/ProducerJobCompletionTypes";

const toPlacementRequests = ({
	items,
	itemInstanceId,
}: {
	items: readonly ProducerDeliveryItem[];
	itemInstanceId: string;
}) =>
	items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: itemInstanceId,
				reason: "line-output",
			}) satisfies GameSaveItemPlacementRequest,
	);

export const placeProducerDeliveryItemsFx = Effect.fn("placeProducerDeliveryItemsFx")(function* ({
	chargeOutcome,
	config,
	deliveryItems,
	liveJob,
	nowMs,
	save,
}: {
	chargeOutcome: ProducerChargeCompletionOutcome | undefined;
	config: GameConfig;
	deliveryItems: readonly ProducerDeliveryItem[];
	liveJob: GameSaveProducerJob;
	nowMs: number;
	save: GameSave;
}) {
	const placementRequests = toPlacementRequests({
		items: deliveryItems,
		itemInstanceId: liveJob.itemInstanceId,
	});
	const seedCell = yield* readBoardItemCellFx({
		itemInstanceId: liveJob.itemInstanceId,
		save,
	});
	const freedBoardItemInstanceIds = chargeOutcome?.removeOnDepleted
		? new Set([liveJob.itemInstanceId])
		: undefined;
	return yield* Effect.either(
		placeGameSaveItemsFx({
			config,
			freedBoardItemInstanceIds,
			items: placementRequests,
			nowMs,
			save,
			seedCell,
		}),
	);
});
