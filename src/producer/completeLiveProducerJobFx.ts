import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { completeProducerJobWithoutDeliveryItemsFx } from "~/producer/completeProducerJobWithoutDeliveryItemsFx";
import { completeProducerJobWithDeliveryItemsFx } from "~/producer/completeProducerJobWithDeliveryItemsFx";
import type { ProducerJobCompletionScope } from "~/producer/ProducerJobCompletionTypes";
import {
	assertProducerLinePlacementSupportedFx,
	readLiveProducerLineFx,
} from "~/producer/readLiveProducerLineFx";
import { rollProducerDeliveryItemsFx } from "~/producer/rollProducerDeliveryItemsFx";

export const completeLiveProducerJobFx = Effect.fn("completeLiveProducerJobFx")(function* ({
	liveJob,
	scope,
}: {
	liveJob: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const line = yield* readLiveProducerLineFx({
		liveJob,
		scope,
	});
	yield* assertProducerLinePlacementSupportedFx(line);
	const deliveryItems = yield* rollProducerDeliveryItemsFx({
		job: liveJob,
		scope,
	});

	return yield* match(deliveryItems.length === 0)
		.with(true, () =>
			completeProducerJobWithoutDeliveryItemsFx({
				liveJob,
				scope,
			}),
		)
		.with(false, () =>
			completeProducerJobWithDeliveryItemsFx({
				deliveryItems,
				liveJob,
				scope,
			}),
		)
		.exhaustive();
});
