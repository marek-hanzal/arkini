import { Effect } from "effect";
import { readBoardItemCellFx } from "~/board/readBoardItemCellFx";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import type { ProducerChargeCompletionOutcome } from "~/producer/completeProducerJobChargesFx";
import type {
	ProducerDeliveryItem,
	ProducerJobCompletionScope,
} from "~/producer/ProducerJobCompletionTypes";

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
	deliveryItems,
	liveJob,
	scope,
}: {
	chargeOutcome: ProducerChargeCompletionOutcome | undefined;
	deliveryItems: readonly ProducerDeliveryItem[];
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { config, nowMs, save } = scope;
	const placementRequests = toPlacementRequests({
		items: deliveryItems,
		itemInstanceId: liveJob.itemInstanceId,
	});
	const seedCell = yield* readBoardItemCellFx({
		itemInstanceId: liveJob.itemInstanceId,
		save,
	});
	const freedBoardItemInstanceIds = chargeOutcome?.removeOnDepleted
		? new Set([
				liveJob.itemInstanceId,
			])
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
