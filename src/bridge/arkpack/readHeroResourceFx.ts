import { Effect } from "effect";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";

/** Reads the required Hero bytes selected by one validated package configuration. */
export const readHeroResourceFx = Effect.fn("readHeroResourceFx")(function* (
	payload: PayloadSchema.Type,
) {
	const resourceId = payload.config.resources.hero;
	const resource = payload.resources.find((candidate) => candidate.id === resourceId);
	if (resource === undefined) {
		return yield* Effect.fail(new Error(`Arkpack Hero resource ${resourceId} is unavailable.`));
	}
	return resource;
});
