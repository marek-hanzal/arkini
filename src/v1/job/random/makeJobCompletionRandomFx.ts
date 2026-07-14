import { Effect, Random } from "effect";

import type { JobSchema } from "~/v1/job/schema/JobSchema";

/** Bump only when intentionally changing completion random compatibility. */
export const JobCompletionRandomVersion = 1;

/**
 * Creates the deterministic random stream owned by one stable job completion.
 *
 * Retries, blocked delivery and state restore must replay the same random
 * choices. Wall-clock state is deliberately excluded.
 */
export const makeJobCompletionRandomFx = Effect.fn("makeJobCompletionRandomFx")(function* (
	job: JobSchema.Type,
) {
	return Random.make(
		`arkini:job-completion:v${JobCompletionRandomVersion}:${job.id}:${job.ownerItemId}:${job.lineId}`,
	);
});
