import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readProducerChargeCompletionOutcomeFx } from "~/producer/completeProducerJobChargesFx";
import { completeProducerPlacementFailureFx } from "~/producer/completeProducerPlacementFailureFx";
import { completeProducerPlacementSuccessFx } from "~/producer/completeProducerPlacementSuccessFx";
import { placeProducerDeliveryItemsFx } from "~/producer/placeProducerDeliveryItemsFx";
import type { ProducerDeliveryItem } from "~/producer/ProducerJobCompletionTypes";

export const completeProducerJobWithDeliveryItemsFx = Effect.fn(
	"completeProducerJobWithDeliveryItemsFx",
)(function* ({
	config,
	deliveryItems,
	liveJob,
	nowMs,
	save,
}: {
	config: GameConfig;
	deliveryItems: readonly ProducerDeliveryItem[];
	liveJob: GameSaveProducerJob;
	nowMs: number;
	save: GameSave;
}) {
	const chargeOutcome = yield* readProducerChargeCompletionOutcomeFx({
		config,
		job: liveJob,
		save,
	});
	const placementEither = yield* placeProducerDeliveryItemsFx({
		chargeOutcome,
		config,
		deliveryItems,
		liveJob,
		nowMs,
		save,
	});

	return yield* match(placementEither)
		.with(
			{
				_tag: "Left",
			},
			({ left }) => {
				if (left._tag !== "GamePlacementFailed") return Effect.fail(left);
				return completeProducerPlacementFailureFx({
					error: left,
					config,
					liveJob,
					nowMs,
					save,
				});
			},
		)
		.with(
			{
				_tag: "Right",
			},
			({ right }) =>
				completeProducerPlacementSuccessFx({
					chargeOutcome,
					config,
					liveJob,
					nowMs,
					placementResult: right,
					save,
				}),
		)
		.exhaustive();
});
