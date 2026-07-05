import { Effect } from "effect";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";
import type { WorldSnapshotValidationScope } from "~/world/WorldSnapshotValidationScope";

export const readProducerJobFactsByIdFx = Effect.fn("readProducerJobFactsByIdFx")(function* ({
	facts,
}: WorldSnapshotValidationScope) {
	return new Map<string, WorldProducerJobFacts>(
		facts.producerJobs.map((producerJobFacts) => [
			producerJobFacts.job.id,
			producerJobFacts,
		]),
	);
});
