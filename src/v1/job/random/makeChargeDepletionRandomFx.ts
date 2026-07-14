import { Effect, Random } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";

/** Bump only when intentionally changing charge-depletion random compatibility. */
export const ChargeDepletionRandomVersion = 1;

/** Creates one deterministic random stream for one charged item depletion. */
export const makeChargeDepletionRandomFx = Effect.fn("makeChargeDepletionRandomFx")(function* ({
	itemId,
	job,
}: {
	itemId: IdSchema.Type;
	job: JobSchema.Type;
}) {
	return Random.make(
		`arkini:charge-depletion:v${ChargeDepletionRandomVersion}:${job.id}:${itemId}`,
	);
});
