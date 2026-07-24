import { Effect, Random } from "effect";

import type { JobSchema } from "~/engine/job/schema/JobSchema";

/** Bump only when intentionally changing completion random compatibility. */
const JobCompletionRandomVersion = 2;

/**
 * Runs the owned program with the deterministic random stream for one stable job completion.
 *
 * Retries, blocked delivery and state restore must replay the same random
 * choices. Wall-clock state is deliberately excluded.
 */
export const makeJobCompletionRandomFx = Effect.fn("makeJobCompletionRandomFx")(function* <
	Result,
	Error,
	Requirements,
>({ job, program }: { job: JobSchema.Type; program: Effect.Effect<Result, Error, Requirements> }) {
	return yield* program.pipe(
		Random.withSeed(
			`arkini:job-completion:v${JobCompletionRandomVersion}:${job.id}:${job.ownerItemId}:${job.lineId}`,
		),
	);
});
