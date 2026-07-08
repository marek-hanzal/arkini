import { Effect } from "effect";
import { createMissingProducerJobResult } from "~/producer/ProducerJobCompletionEvents";
import { completeLiveProducerJobFx } from "~/producer/completeLiveProducerJobFx";
import type { ProducerJobCompletionProps } from "~/producer/ProducerJobCompletionTypes";
import { readLiveProducerJobFx } from "~/producer/readLiveProducerJobFx";

const completeProducerJobProgramFx = Effect.fn("completeProducerJobProgramFx")(function* ({
	config,
	job,
	nowMs,
	save,
}: ProducerJobCompletionProps) {
	const liveJob = yield* readLiveProducerJobFx({
		jobId: job.id,
		save,
	});
	if (!liveJob) {
		return createMissingProducerJobResult({
			save,
		});
	}

	return yield* completeLiveProducerJobFx({
		config,
		liveJob,
		nowMs,
		save,
	});
});

export const completeProducerJobFx = Effect.fn("completeProducerJobFx")(function* (
	props: ProducerJobCompletionProps,
) {
	return yield* completeProducerJobProgramFx(props);
});
