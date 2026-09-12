import { Effect, Random } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";

/** Bump only when intentionally changing unit-depletion random compatibility. */
const UnitDepletionRandomVersion = 2;

/** Runs the owned program with deterministic random for one item with units depletion. */
export const makeUnitDepletionRandomFx = Effect.fn("makeUnitDepletionRandomFx")(function* <
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
	// The seed namespace is stable gameplay identity; terminology changes must not reroll output.
	return yield* program.pipe(
		Random.withSeed(
			`arkini:charge-depletion:v${UnitDepletionRandomVersion}:${job.id}:${itemId}`,
		),
	);
});
