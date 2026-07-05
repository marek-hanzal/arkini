import { Effect } from "effect";
import type { ProducerJobCompletionScope } from "~/producer/ProducerJobCompletionTypes";

export const readLiveProducerJobFx = Effect.fn("readLiveProducerJobFx")(function* (
	scope: ProducerJobCompletionScope,
) {
	return scope.save.producerJobs[scope.job.id];
});
