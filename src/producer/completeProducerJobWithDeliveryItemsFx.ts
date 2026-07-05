import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { readProducerChargeCompletionOutcomeFx } from "~/producer/completeProducerJobChargesFx";
import { completeProducerPlacementFailureFx } from "~/producer/completeProducerPlacementFailureFx";
import { completeProducerPlacementSuccessFx } from "~/producer/completeProducerPlacementSuccessFx";
import { placeProducerDeliveryItemsFx } from "~/producer/placeProducerDeliveryItemsFx";
import type {
	ProducerDeliveryItem,
	ProducerJobCompletionScope,
} from "~/producer/ProducerJobCompletionTypes";

export const completeProducerJobWithDeliveryItemsFx = Effect.fn(
	"completeProducerJobWithDeliveryItemsFx",
)(function* ({
	deliveryItems,
	liveJob,
	scope,
}: {
	deliveryItems: readonly ProducerDeliveryItem[];
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { save } = scope;
	const chargeOutcome = yield* readProducerChargeCompletionOutcomeFx({
		config: scope.config,
		job: liveJob,
		save,
	});
	const placementEither = yield* placeProducerDeliveryItemsFx({
		chargeOutcome,
		deliveryItems,
		liveJob,
		scope,
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
					liveJob,
					scope,
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
					liveJob,
					placementResult: right,
					scope,
				}),
		)
		.exhaustive();
});
