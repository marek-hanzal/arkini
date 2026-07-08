import { Effect } from "effect";
import type { WorldSnapshotFacts } from "~/world/WorldSnapshotFacts";
import type { WorldProducerJobFacts } from "~/world/WorldProducerJobFacts";

export const readProducerJobFactsByIdFx = Effect.fn("readProducerJobFactsByIdFx")(function* ({
	facts,
}: {
	facts: WorldSnapshotFacts;
}) {
	return new Map<string, WorldProducerJobFacts>(
		facts.producerJobs.map((producerJobFacts) => [producerJobFacts.job.id, producerJobFacts]),
	);
});
