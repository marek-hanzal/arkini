import { Effect, Random } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";

/** Bump only when intentionally changing charge-depletion random compatibility. */
const ChargeDepletionRandomVersion = 2;

/** Runs the owned program with deterministic random for one charged item depletion. */
export const makeChargeDepletionRandomFx = Effect.fn("makeChargeDepletionRandomFx")(function* <
	Result,
	Error,
	Requirements,
>({
	itemId,
	job,
	program,
}: {
	itemId: IdSchema.Type;
	job: JobSchema.Type;
	program: Effect.Effect<Result, Error, Requirements>;
}) {
	return yield* program.pipe(
		Random.withSeed(
			`arkini:charge-depletion:v${ChargeDepletionRandomVersion}:${job.id}:${itemId}`,
		),
	);
});
