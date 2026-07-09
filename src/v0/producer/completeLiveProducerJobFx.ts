import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { completeProducerJobWithoutDeliveryItemsFx } from "~/producer/completeProducerJobWithoutDeliveryItemsFx";
import { completeProducerJobWithDeliveryItemsFx } from "~/producer/completeProducerJobWithDeliveryItemsFx";
import {
	assertProducerLinePlacementSupportedFx,
	readLiveProducerLineFx,
} from "~/producer/readLiveProducerLineFx";
import { rollProducerDeliveryItemsFx } from "~/producer/rollProducerDeliveryItemsFx";

export const completeLiveProducerJobFx = Effect.fn("completeLiveProducerJobFx")(function* ({
	config,
	liveJob,
	nowMs,
	save,
}: {
	config: GameConfig;
	liveJob: GameSaveProducerJob;
	nowMs: number;
	save: GameSave;
}) {
	const line = yield* readLiveProducerLineFx({
		config,
		liveJob,
		save,
	});
	yield* assertProducerLinePlacementSupportedFx(line);
	const deliveryItems = yield* rollProducerDeliveryItemsFx({
		config,
		job: liveJob,
		nowMs,
		save,
	});

	return yield* match(deliveryItems.length === 0)
		.with(true, () =>
			completeProducerJobWithoutDeliveryItemsFx({
				config,
				liveJob,
				nowMs,
				save,
			}),
		)
		.with(false, () =>
			completeProducerJobWithDeliveryItemsFx({
				config,
				deliveryItems,
				liveJob,
				nowMs,
				save,
			}),
		)
		.exhaustive();
});
